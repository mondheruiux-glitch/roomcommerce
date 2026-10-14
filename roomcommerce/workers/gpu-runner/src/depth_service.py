"""
depth_service.py — Stage 2: Monocular Depth Estimation
Satisfies: FR-103

Loads Depth Anything V2 (ViT-Base) in fp16 on CUDA and generates a
normalized 3-channel RGB depth map suitable for ControlNet conditioning.
"""
import torch
import numpy as np
from PIL import Image
try:
    from transformers import AutoImageProcessor, AutoModelForDepthEstimation
except ImportError:
    AutoImageProcessor = None
    AutoModelForDepthEstimation = None


class DepthEstimationService:
    """Wraps Depth-Anything-V2-Base-hf for real-time room depth extraction."""

    _MODEL_ID = "depth-anything/Depth-Anything-V2-Base-hf"

    def __init__(self, device: str = "cuda") -> None:
        self.device = device
        if AutoImageProcessor is None or AutoModelForDepthEstimation is None:
            raise ImportError(
                "transformers package is required for DepthEstimationService."
            )
        self.processor = AutoImageProcessor.from_pretrained(self._MODEL_ID)
        self.model = (
            AutoModelForDepthEstimation.from_pretrained(
                self._MODEL_ID,
                torch_dtype=torch.float16,
            )
            .to(self.device)
            .eval()
        )

    def generate_depth_map(self, pil_image: Image.Image) -> Image.Image:
        """Generates a normalized 8-bit 3-channel RGB depth map.

        The returned image matches the spatial dimensions of `pil_image` and
        is ready for direct use as a ControlNet conditioning image (FR-103).

        Args:
            pil_image: Original room photograph as a PIL RGB image.

        Returns:
            3-channel RGB PIL Image with pixel values in [0, 255].
        """
        original_w, original_h = pil_image.size

        inputs = self.processor(images=pil_image, return_tensors="pt").to(self.device)

        with torch.no_grad():
            predicted_depth = self.model(**inputs).predicted_depth

        # Bicubic upsample back to original dimensions (FR-103 — aligned to room bounds)
        prediction = torch.nn.functional.interpolate(
            predicted_depth.unsqueeze(1),
            size=(original_h, original_w),
            mode="bicubic",
            align_corners=False,
        ).squeeze()

        depth_np: np.ndarray = prediction.cpu().float().numpy()

        # Normalize to [0, 255] uint8
        d_min, d_max = depth_np.min(), depth_np.max()
        depth_norm = (depth_np - d_min) / (d_max - d_min + 1e-8)
        depth_uint8 = (depth_norm * 255.0).astype(np.uint8)

        # Convert to 3-channel RGB — ControlNet expects a colour image
        return Image.fromarray(depth_uint8).convert("RGB")
