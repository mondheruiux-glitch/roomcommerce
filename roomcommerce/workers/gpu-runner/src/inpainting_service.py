"""
inpainting_service.py — Stage 3: Style-Conditioned Spatial Inpainting
Satisfies: FR-104, FR-201, FR-301

Loads SDXL ControlNet Inpainting in fp16 with depth-guided conditioning.
EulerAncestralDiscreteScheduler at 28 steps targets ~6.5s warm latency.
VAE tiling keeps peak VRAM ≤ 20.5 GB on NVIDIA L4 (24 GB).
"""
import torch
from PIL import Image
try:
    from diffusers import (
        ControlNetModel,
        EulerAncestralDiscreteScheduler,
        StableDiffusionXLControlNetInpaintPipeline,
    )
except ImportError:
    ControlNetModel = None
    EulerAncestralDiscreteScheduler = None
    StableDiffusionXLControlNetInpaintPipeline = None

from .style_prompts import NEGATIVE_PROMPT, STYLE_PRESET_PROMPTS


class SpatialInpaintingService:
    """SDXL ControlNet Inpainting conditioned on depth maps and style presets."""

    _BASE_MODEL = "diffusers/stable-diffusion-xl-1.0-inpainting-0.1"
    _CONTROLNET_MODEL = "diffusers/controlnet-depth-sdxl-1.0"

    def __init__(self, device: str = "cuda") -> None:
        self.device = device
        if ControlNetModel is None or StableDiffusionXLControlNetInpaintPipeline is None:
            raise ImportError(
                "diffusers package is required for SpatialInpaintingService."
            )

        controlnet = ControlNetModel.from_pretrained(
            self._CONTROLNET_MODEL,
            torch_dtype=torch.float16,
        )

        self.pipe = StableDiffusionXLControlNetInpaintPipeline.from_pretrained(
            self._BASE_MODEL,
            controlnet=controlnet,
            torch_dtype=torch.float16,
            variant="fp16",
        ).to(self.device)

        # EulerAncestralDiscreteScheduler — balances speed and photorealism at 28 steps
        self.pipe.scheduler = EulerAncestralDiscreteScheduler.from_config(
            self.pipe.scheduler.config
        )

        # VAE tiling prevents OOM on 24 GB VRAM for high-res images (NFR-04)
        self.pipe.enable_vae_tiling()

    def inpaint_room(
        self,
        original_image: Image.Image,
        depth_map: Image.Image,
        inpaint_mask: Image.Image,
        style_preset: str,
        seed: int = 42,
    ) -> Image.Image:
        """Executes depth-conditioned spatial inpainting bounded by the style preset.

        Args:
            original_image:  Original room photograph (PIL RGB).
            depth_map:       3-channel RGB depth map from DepthEstimationService.
            inpaint_mask:    Greyscale mask; white pixels (255) are repainted.
            style_preset:    One of the 8 keys in STYLE_PRESET_PROMPTS.
            seed:            Deterministic generator seed for reproducibility.

        Returns:
            PIL RGB image — the inpainted room render.
        """
        prompt = STYLE_PRESET_PROMPTS.get(style_preset, STYLE_PRESET_PROMPTS["JAPANDI"])
        generator = torch.Generator(device=self.device).manual_seed(seed)

        # 28 steps / guidance 7.5 / conditioning 0.8 — targets ~6.5s warm latency (FR-104)
        result = self.pipe(
            prompt=prompt,
            negative_prompt=NEGATIVE_PROMPT,
            image=original_image,
            mask_image=inpaint_mask,
            control_image=depth_map,
            num_inference_steps=28,
            guidance_scale=7.5,
            controlnet_conditioning_scale=0.8,
            generator=generator,
        )

        return result.images[0]
