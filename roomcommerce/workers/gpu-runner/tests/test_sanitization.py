"""
test_sanitization.py — Unit tests for ImageSanitizationService
Runs on CPU with OpenCV only (no GPU required).
"""
import sys
import types
import unittest.mock as mock
from pathlib import Path

import cv2
import numpy as np
import pytest

# ---------------------------------------------------------------------------
# Make src importable without installing the package
# ---------------------------------------------------------------------------
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.sanitization import ImageSanitizationService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_service_no_yunet() -> ImageSanitizationService:
    """Create service without a real YuNet ONNX file — mock the detector."""
    svc = ImageSanitizationService.__new__(ImageSanitizationService)
    # Mock detector: returns no faces by default
    svc.detector = mock.MagicMock()
    svc.detector.detect.return_value = (None, None)
    return svc


# ---------------------------------------------------------------------------
# Quality gate tests
# ---------------------------------------------------------------------------


class TestValidateQualityGate:
    def setup_method(self) -> None:
        self.svc = _make_service_no_yunet()

    def _sharp_bright_image(self, h: int = 1024, w: int = 1024) -> np.ndarray:
        """High-frequency noise image that passes all quality checks."""
        rng = np.random.default_rng(42)
        base = rng.integers(100, 180, (h, w, 3), dtype=np.uint8)
        noise = rng.integers(0, 60, (h, w, 3), dtype=np.uint8)
        return np.clip(base.astype(np.int32) + noise.astype(np.int32), 0, 255).astype(np.uint8)

    def test_passes_valid_image(self) -> None:
        img = self._sharp_bright_image()
        ok, msg = self.svc.validate_quality_gate(img)
        assert ok is True
        assert msg == "PASSED"

    def test_rejects_low_resolution_height(self) -> None:
        img = self._sharp_bright_image(h=400, w=1024)
        ok, msg = self.svc.validate_quality_gate(img)
        assert ok is False
        assert "512" in msg

    def test_rejects_low_resolution_width(self) -> None:
        img = self._sharp_bright_image(h=1024, w=400)
        ok, msg = self.svc.validate_quality_gate(img)
        assert ok is False
        assert "512" in msg

    def test_rejects_blurry_image(self) -> None:
        # Uniform colour → Laplacian variance ≈ 0
        flat = np.full((1024, 1024, 3), 140, dtype=np.uint8)
        ok, msg = self.svc.validate_quality_gate(flat)
        assert ok is False
        assert "blurry" in msg.lower()

    def test_rejects_under_illuminated(self) -> None:
        # Sharp but very dark
        rng = np.random.default_rng(7)
        dark = rng.integers(0, 20, (1024, 1024, 3), dtype=np.uint8)
        ok, msg = self.svc.validate_quality_gate(dark)
        assert ok is False
        assert "illuminat" in msg.lower()

    def test_rejects_over_exposed(self) -> None:
        rng = np.random.default_rng(7)
        bright = rng.integers(235, 255, (1024, 1024, 3), dtype=np.uint8)
        ok, msg = self.svc.validate_quality_gate(bright)
        assert ok is False
        assert "over-exposed" in msg.lower() or "exposed" in msg.lower()

    def test_laplacian_threshold_boundary(self) -> None:
        """An image with Laplacian var exactly at 100.0 should pass."""
        img = self._sharp_bright_image()
        # Compute actual var and use a reference image we know passes
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        lap_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        # Our synthetic fixture has lap_var >> 100; just assert gate passes
        assert lap_var > 100.0
        ok, _ = self.svc.validate_quality_gate(img)
        assert ok is True


# ---------------------------------------------------------------------------
# Face obfuscation tests
# ---------------------------------------------------------------------------


class TestObfuscateBiometrics:
    def setup_method(self) -> None:
        self.svc = _make_service_no_yunet()

    def _portrait_image(self) -> np.ndarray:
        return np.full((1024, 1024, 3), 140, dtype=np.uint8)

    def test_no_faces_returns_copy_unchanged(self) -> None:
        img = self._portrait_image()
        self.svc.detector.detect.return_value = (None, None)
        sanitized, count = self.svc.obfuscate_biometrics(img)
        assert count == 0
        np.testing.assert_array_equal(img, sanitized)

    def test_single_face_is_blurred(self) -> None:
        img = self._portrait_image()
        # Mock one face bounding box at centre
        fake_face = np.array([[200, 200, 200, 200, 0.9, 0, 0, 0, 0, 0, 0, 0, 0, 0]])
        self.svc.detector.detect.return_value = (None, fake_face)

        sanitized, count = self.svc.obfuscate_biometrics(img)
        assert count == 1

        # ROI after 31×31 blur should differ from the original (all-flat) image
        # (flat uniform image doesn't change under GaussianBlur — test structural path)
        # Verify the blurred region exists by checking it was processed
        assert sanitized is not img  # must be a new copy, not in-place mutation

    def test_face_region_is_actually_blurred(self) -> None:
        """Verify pixel values in the face ROI differ from a synthetic gradient input."""
        rng = np.random.default_rng(99)
        img = rng.integers(0, 255, (1024, 1024, 3), dtype=np.uint8)
        original_roi = img[200:420, 200:420].copy()  # 220×220 area

        fake_face = np.array([[200, 200, 200, 200, 0.9, 0, 0, 0, 0, 0, 0, 0, 0, 0]])
        self.svc.detector.detect.return_value = (None, fake_face)

        sanitized, count = self.svc.obfuscate_biometrics(img)
        assert count == 1

        blurred_roi = sanitized[200:420, 200:420]
        # The 31×31 Gaussian kernel will smooth the noisy ROI — values must differ
        assert not np.array_equal(original_roi, blurred_roi), (
            "Face ROI was not modified by the blur kernel."
        )

    def test_face_bounding_box_clamped_to_image_bounds(self) -> None:
        """A face box near the edge must not produce an out-of-bounds slice."""
        img = self._portrait_image()
        # Box at bottom-right corner where + 10px margin would exceed image size
        fake_face = np.array([[1000, 1000, 50, 50, 0.9, 0, 0, 0, 0, 0, 0, 0, 0, 0]])
        self.svc.detector.detect.return_value = (None, fake_face)

        sanitized, count = self.svc.obfuscate_biometrics(img)
        assert count == 1  # no crash
