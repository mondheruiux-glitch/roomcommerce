"""
pipeline_runner.py — Stage 6: End-to-End Orchestrator & Profiler
Satisfies: NFR-01, NFR-04, NFR-05

SpatialPipelineRunner chains all pipeline stages, records per-stage timing in
milliseconds, measures peak GPU VRAM, and enforces the unit-cost budget cap.
"""
import time
from typing import Any, Dict, Optional

import cv2
import numpy as np
import torch
from PIL import Image

from .depth_service import DepthEstimationService
from .inpainting_service import SpatialInpaintingService
from .sanitization import ImageSanitizationService
from .segmentation_extractor import FurnitureExtractionService

# NVIDIA L4 on-demand rate: $0.85/hr → $0.000236/sec (2026 pricing)
_L4_COST_PER_SEC: float = 0.85 / 3600  # ≈ $0.000236/s
_MAX_COST_USD: float = 0.040  # unit-economic hard cap (NFR-05)


def _peak_vram_gb() -> float:
    """Returns peak VRAM allocated since last reset, in GB. Returns 0.0 on CPU."""
    if not torch.cuda.is_available():
        return 0.0
    return round(torch.cuda.max_memory_allocated() / 1024**3, 3)


class SpatialPipelineRunner:
    """Chains Sanitization → Depth → Inpainting → Segmentation & Embedding stages."""

    def __init__(
        self,
        sanitization: Optional[ImageSanitizationService] = None,
        depth_service: Optional[DepthEstimationService] = None,
        inpainting: Optional[SpatialInpaintingService] = None,
        extractor: Optional[FurnitureExtractionService] = None,
    ) -> None:
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.sanitization = sanitization or ImageSanitizationService()
        self.depth_service = depth_service or DepthEstimationService(device=self.device)
        self.inpainting = inpainting or SpatialInpaintingService(device=self.device)
        self.extractor = extractor or FurnitureExtractionService(device=self.device)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def execute_job(
        self, input_image_path: str, style_preset: str, budget_cents: int = 150000
    ) -> Dict[str, Any]:
        """Execute the full pipeline from a file path.

        Args:
            input_image_path:  Path to the JPEG/PNG room photograph.
            style_preset:      One of the 8 style keys (e.g. "JAPANDI").
            budget_cents:      Max allowed spend in integer cents (informational).

        Returns:
            Dict containing status, rendered_image, hotspots, timings,
            compute_cost_usd, and faces_obfuscated.
        """
        img_bgr = cv2.imread(input_image_path)
        if img_bgr is None:
            return {
                "status": "FAILED",
                "error_code": "IMAGE_READ_ERROR",
                "message": f"Could not read image at path: {input_image_path}",
            }
        return self.execute_job_from_array(img_bgr, style_preset, budget_cents)

    def execute_job_from_array(
        self, img_bgr: np.ndarray, style_preset: str, budget_cents: int = 150000
    ) -> Dict[str, Any]:
        """Execute the full pipeline from an in-memory BGR NumPy array.

        Used by the Modal entry point which decodes bytes → ndarray before calling here.
        """
        if torch.cuda.is_available():
            torch.cuda.reset_peak_memory_stats()

        timings: Dict[str, float] = {}
        t0 = time.perf_counter()

        # ── Stage 1: Sanitization ──────────────────────────────────────
        is_valid, msg = self.sanitization.validate_quality_gate(img_bgr)
        if not is_valid:
            return {"status": "FAILED", "error_code": "IMAGE_QUALITY_FAILED", "message": msg}

        sanitized_bgr, faces_obfuscated = self.sanitization.obfuscate_biometrics(img_bgr)
        pil_input = Image.fromarray(cv2.cvtColor(sanitized_bgr, cv2.COLOR_BGR2RGB))
        timings["sanitization_ms"] = _elapsed_ms(t0)
        timings["sanitization_vram_gb"] = _peak_vram_gb()

        # ── Stage 2: Depth Estimation (~1.8s) ─────────────────────────
        t_depth = time.perf_counter()
        depth_map = self.depth_service.generate_depth_map(pil_input)
        timings["depth_ms"] = _elapsed_ms(t_depth)
        timings["depth_vram_gb"] = _peak_vram_gb()

        # ── Stage 3: Diffusion Inpainting (~6.5s) ─────────────────────
        t_inpaint = time.perf_counter()
        w, h = pil_input.size
        # Full-room repaint mask: all white pixels (can be narrowed by caller later)
        mask = Image.new("L", (w, h), 255)
        rendered_image = self.inpainting.inpaint_room(pil_input, depth_map, mask, style_preset)
        timings["inpainting_ms"] = _elapsed_ms(t_inpaint)
        timings["inpainting_vram_gb"] = _peak_vram_gb()

        # ── Stages 4 & 5: Segmentation & SigLIP Extraction (~2.5s) ───
        t_extract = time.perf_counter()
        # shortcut: bounding boxes are mocked here; real Grounding DINO + MobileSAM
        # inference is wired in Step 4 (04_CORE_BACKEND_API_PLAN.md) once the
        # NestJS worker queue is operational.
        mock_boxes = [
            {
                "category": "sofa",
                "xmin": int(w * 0.20),
                "ymin": int(h * 0.40),
                "xmax": int(w * 0.80),
                "ymax": int(h * 0.85),
            },
            {
                "category": "coffee_table",
                "xmin": int(w * 0.35),
                "ymin": int(h * 0.65),
                "xmax": int(w * 0.65),
                "ymax": int(h * 0.88),
            },
        ]
        hotspots = self.extractor.extract_detected_items(rendered_image, mock_boxes)
        timings["extraction_ms"] = _elapsed_ms(t_extract)
        timings["extraction_vram_gb"] = _peak_vram_gb()

        # ── Telemetry ──────────────────────────────────────────────────
        total_latency_ms = round((time.perf_counter() - t0) * 1000, 2)
        timings["total_latency_ms"] = total_latency_ms

        # Unit compute cost — NVIDIA L4 rate (NFR-05)
        compute_cost_usd = round((total_latency_ms / 1000.0) * _L4_COST_PER_SEC, 5)
        assert compute_cost_usd <= _MAX_COST_USD, (
            f"Compute cost ${compute_cost_usd:.5f} exceeds $0.040 cap. "
            "Reduce inference steps or switch scheduler."
        )

        return {
            "status": "COMPLETED",
            "rendered_image": rendered_image,
            "hotspots": hotspots,
            "timings": timings,
            "compute_cost_usd": compute_cost_usd,
            "faces_obfuscated": faces_obfuscated,
        }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _elapsed_ms(t_start: float) -> float:
    return round((time.perf_counter() - t_start) * 1000, 2)
