"""
test_embeddings.py — Unit tests for FurnitureExtractionService (SigLIP)
Verifies: 768-dim output, L2 norm == 1.0000, normalised coord clamping.
All tests run on CPU with mocked SigLIP model (no GPU required).
"""
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np
import pytest
import torch
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent.parent))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_service(embedding_dim: int = 768):
    """Build FurnitureExtractionService with HuggingFace mocked."""
    with (
        patch("src.segmentation_extractor.AutoProcessor") as MockProc,
        patch("src.segmentation_extractor.AutoModel") as MockModel,
    ):
        # Processor: returns a simple batch mock
        mock_proc_inst = MagicMock()

        class _Batch(dict):
            def to(self, device):
                return self

        mock_proc_inst.return_value = _Batch()
        MockProc.from_pretrained.return_value = mock_proc_inst

        # Model: get_image_features returns a unit-norm tensor per image
        mock_model_inst = MagicMock()
        mock_model_inst.to.return_value = mock_model_inst
        mock_model_inst.eval.return_value = mock_model_inst
        MockModel.from_pretrained.return_value = mock_model_inst

        from src.segmentation_extractor import FurnitureExtractionService

        svc = FurnitureExtractionService(device="cpu")
        svc._embedding_dim = embedding_dim  # store for test use
        return svc, mock_model_inst


def _make_test_image(w: int = 1024, h: int = 768) -> Image.Image:
    arr = np.random.randint(80, 200, (h, w, 3), dtype=np.uint8)
    return Image.fromarray(arr)


def _fake_get_image_features(n_crops: int, dim: int = 768):
    """Returns a random float tensor pre-L2-normalised (as the service will normalise)."""
    raw = torch.randn(n_crops, dim)
    # Return un-normalised; the service normalises internally
    return raw


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestSigLIPEmbeddingDimensionality:
    def test_embedding_is_768_dimensional(self) -> None:
        svc, mock_model = _build_service(embedding_dim=768)
        image = _make_test_image()
        boxes = [{"category": "sofa", "xmin": 100, "ymin": 100, "xmax": 400, "ymax": 350}]

        mock_model.get_image_features.return_value = _fake_get_image_features(1, 768)

        hotspots = svc.extract_detected_items(image, boxes)
        assert len(hotspots) == 1
        emb = hotspots[0]["embedding"]
        assert len(emb) == 768, f"Expected 768-dim embedding, got {len(emb)}"

    def test_embedding_l2_norm_equals_one(self) -> None:
        """After L2 normalisation, ||v||₂ must equal 1.0000 ± 0.0001."""
        svc, mock_model = _build_service()
        image = _make_test_image()
        boxes = [
            {"category": "sofa", "xmin": 100, "ymin": 100, "xmax": 400, "ymax": 350},
            {"category": "table", "xmin": 500, "ymin": 300, "xmax": 800, "ymax": 550},
        ]

        mock_model.get_image_features.return_value = _fake_get_image_features(2, 768)

        hotspots = svc.extract_detected_items(image, boxes)
        assert len(hotspots) == 2

        for hotspot in hotspots:
            vec = np.array(hotspot["embedding"], dtype=np.float32)
            norm = float(np.linalg.norm(vec))
            assert abs(norm - 1.0) < 0.0001, (
                f"L2 norm {norm:.6f} deviates from 1.0000 by > 0.0001 for {hotspot['category']}"
            )


class TestNormalisedCoordinates:
    def test_centroid_coords_are_in_unit_range(self) -> None:
        svc, mock_model = _build_service()
        image = _make_test_image(w=1024, h=768)
        boxes = [{"category": "sofa", "xmin": 100, "ymin": 100, "xmax": 400, "ymax": 350}]
        mock_model.get_image_features.return_value = _fake_get_image_features(1, 768)

        hotspots = svc.extract_detected_items(image, boxes)
        assert hotspots[0]["norm_x"] >= 0.0
        assert hotspots[0]["norm_x"] <= 1.0
        assert hotspots[0]["norm_y"] >= 0.0
        assert hotspots[0]["norm_y"] <= 1.0

    def test_centroid_coords_are_rounded_to_4dp(self) -> None:
        svc, mock_model = _build_service()
        image = _make_test_image(w=1024, h=768)
        boxes = [{"category": "chair", "xmin": 100, "ymin": 200, "xmax": 300, "ymax": 400}]
        mock_model.get_image_features.return_value = _fake_get_image_features(1, 768)

        hotspots = svc.extract_detected_items(image, boxes)
        norm_x = hotspots[0]["norm_x"]
        # Verify no more than 4 decimal places
        assert round(norm_x, 4) == norm_x

    def test_box_outside_image_coords_are_clamped(self) -> None:
        """Coordinates that would produce > 1.0 must be clamped to exactly 1.0."""
        svc, mock_model = _build_service()
        image = _make_test_image(w=100, h=100)
        # Box deliberately exceeds image bounds
        boxes = [{"category": "lamp", "xmin": 80, "ymin": 80, "xmax": 200, "ymax": 200}]
        mock_model.get_image_features.return_value = _fake_get_image_features(1, 768)

        hotspots = svc.extract_detected_items(image, boxes)
        assert hotspots[0]["norm_x"] <= 1.0
        assert hotspots[0]["norm_y"] <= 1.0


class TestCropFiltering:
    def test_small_crops_are_filtered(self) -> None:
        """Crops < 32×32 px must be silently discarded."""
        svc, mock_model = _build_service()
        image = _make_test_image()
        # 20×20 crop — below 32px threshold
        boxes = [{"category": "knob", "xmin": 100, "ymin": 100, "xmax": 120, "ymax": 120}]

        hotspots = svc.extract_detected_items(image, boxes)
        assert hotspots == [], "Sub-32px crops should be filtered out"

    def test_empty_boxes_returns_empty_list(self) -> None:
        svc, mock_model = _build_service()
        image = _make_test_image()
        hotspots = svc.extract_detected_items(image, [])
        assert hotspots == []

    def test_mixed_valid_and_small_boxes(self) -> None:
        """Only valid (≥32px) crops produce hotspots."""
        svc, mock_model = _build_service()
        image = _make_test_image()
        boxes = [
            {"category": "sofa", "xmin": 100, "ymin": 100, "xmax": 400, "ymax": 350},  # valid
            {"category": "micro", "xmin": 500, "ymin": 500, "xmax": 515, "ymax": 510},  # too small
        ]
        mock_model.get_image_features.return_value = _fake_get_image_features(1, 768)

        hotspots = svc.extract_detected_items(image, boxes)
        assert len(hotspots) == 1
        assert hotspots[0]["category"] == "sofa"
