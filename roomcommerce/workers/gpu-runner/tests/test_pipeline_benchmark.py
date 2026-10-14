"""
test_pipeline_benchmark.py — End-to-end pipeline smoke test & economics check.
All heavy models are mocked; the test exercises the orchestration logic and
asserts the latency / cost maths, not GPU execution time.
"""
import sys
import time
from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np
import pytest
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent.parent))


# ---------------------------------------------------------------------------
# Full pipeline mock helper
# ---------------------------------------------------------------------------


def _make_mock_pipeline_runner():
    """Return a SpatialPipelineRunner where all GPU services are mocked."""
    from src.pipeline_runner import SpatialPipelineRunner

    runner = SpatialPipelineRunner.__new__(SpatialPipelineRunner)
    runner.device = "cpu"

    # ── Sanitization mock ──────────────────────────────────────────────
    mock_san = MagicMock()
    mock_san.validate_quality_gate.return_value = (True, "PASSED")
    rng = np.random.default_rng(0)
    fake_bgr = rng.integers(80, 200, (1024, 1024, 3), dtype=np.uint8)
    mock_san.obfuscate_biometrics.return_value = (fake_bgr, 0)
    runner.sanitization = mock_san

    # ── Depth mock ────────────────────────────────────────────────────
    mock_depth = MagicMock()
    mock_depth.generate_depth_map.return_value = Image.fromarray(
        np.zeros((1024, 1024, 3), dtype=np.uint8)
    )
    runner.depth_service = mock_depth

    # ── Inpainting mock ───────────────────────────────────────────────
    mock_inpaint = MagicMock()
    mock_inpaint.inpaint_room.return_value = Image.fromarray(
        rng.integers(80, 200, (1024, 1024, 3), dtype=np.uint8)
    )
    runner.inpainting = mock_inpaint

    # ── Extractor mock ────────────────────────────────────────────────
    import torch

    fake_embedding = (torch.randn(768) / torch.randn(768).norm()).tolist()
    mock_extractor = MagicMock()
    mock_extractor.extract_detected_items.return_value = [
        {
            "category": "sofa",
            "norm_x": 0.5000,
            "norm_y": 0.6250,
            "embedding": fake_embedding,
            "bounding_box": [200, 400, 800, 850],
        }
    ]
    runner.extractor = mock_extractor

    return runner


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestPipelineBenchmark:
    def test_execute_job_from_array_returns_completed(self) -> None:
        runner = _make_mock_pipeline_runner()
        rng = np.random.default_rng(1)
        img_bgr = rng.integers(80, 200, (1024, 1024, 3), dtype=np.uint8)

        result = runner.execute_job_from_array(img_bgr, "JAPANDI", 150_000)

        assert result["status"] == "COMPLETED"
        assert "rendered_image" in result
        assert "hotspots" in result
        assert "timings" in result
        assert "compute_cost_usd" in result
        assert "faces_obfuscated" in result

    def test_timings_dict_contains_all_stages(self) -> None:
        runner = _make_mock_pipeline_runner()
        rng = np.random.default_rng(2)
        img_bgr = rng.integers(80, 200, (1024, 1024, 3), dtype=np.uint8)
        result = runner.execute_job_from_array(img_bgr, "SCANDINAVIAN")

        expected_keys = {
            "sanitization_ms",
            "depth_ms",
            "inpainting_ms",
            "extraction_ms",
            "total_latency_ms",
        }
        assert expected_keys.issubset(result["timings"].keys()), (
            f"Missing timing keys: {expected_keys - result['timings'].keys()}"
        )

    def test_compute_cost_within_cap(self) -> None:
        """Unit cost must remain ≤ $0.040 (NFR-05)."""
        runner = _make_mock_pipeline_runner()
        rng = np.random.default_rng(3)
        img_bgr = rng.integers(80, 200, (1024, 1024, 3), dtype=np.uint8)
        result = runner.execute_job_from_array(img_bgr, "MINIMALIST")
        assert result["compute_cost_usd"] <= 0.040

    def test_quality_gate_failure_short_circuits_pipeline(self) -> None:
        """Pipeline must exit early on quality failure, not attempt depth/inpainting."""
        runner = _make_mock_pipeline_runner()
        runner.sanitization.validate_quality_gate.return_value = (
            False,
            "Image is excessively blurry.",
        )
        rng = np.random.default_rng(4)
        img_bgr = rng.integers(0, 10, (1024, 1024, 3), dtype=np.uint8)

        result = runner.execute_job_from_array(img_bgr, "JAPANDI")

        assert result["status"] == "FAILED"
        assert result["error_code"] == "IMAGE_QUALITY_FAILED"
        # Depth and inpainting must NOT have been called
        runner.depth_service.generate_depth_map.assert_not_called()
        runner.inpainting.inpaint_room.assert_not_called()

    def test_warm_latency_threshold(self) -> None:
        """Mocked pipeline latency must be well under 13s (only limited by Python overhead)."""
        runner = _make_mock_pipeline_runner()
        rng = np.random.default_rng(5)
        img_bgr = rng.integers(80, 200, (1024, 1024, 3), dtype=np.uint8)

        t0 = time.perf_counter()
        result = runner.execute_job_from_array(img_bgr, "BOHEMIAN")
        wall_s = time.perf_counter() - t0

        # Mocked pipeline should complete in well under 1s
        assert wall_s < 1.0, f"Mocked pipeline took {wall_s:.2f}s — orchestration overhead too high"
        # Reported total_latency_ms is derived from perf_counter inside the runner
        assert result["timings"]["total_latency_ms"] >= 0

    def test_hotspot_embedding_shape(self) -> None:
        runner = _make_mock_pipeline_runner()
        rng = np.random.default_rng(6)
        img_bgr = rng.integers(80, 200, (1024, 1024, 3), dtype=np.uint8)
        result = runner.execute_job_from_array(img_bgr, "CONTEMPORARY")

        assert len(result["hotspots"]) > 0
        for hotspot in result["hotspots"]:
            assert len(hotspot["embedding"]) == 768
            assert 0.0 <= hotspot["norm_x"] <= 1.0
            assert 0.0 <= hotspot["norm_y"] <= 1.0
