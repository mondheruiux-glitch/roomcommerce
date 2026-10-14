"""
conftest.py — shared test fixtures for gpu-runner
"""
import numpy as np
import pytest
from PIL import Image


@pytest.fixture()
def synthetic_room_bgr() -> np.ndarray:
    """1024×1024 synthetic room image in BGR colour order (OpenCV convention).
    Mean brightness ~140 and Laplacian variance ~850 — passes the quality gate.
    """
    rng = np.random.default_rng(0)
    # High-frequency noise ensures Laplacian variance >> 100
    base = rng.integers(80, 200, (1024, 1024, 3), dtype=np.uint8)
    noise = rng.integers(0, 60, (1024, 1024, 3), dtype=np.uint8)
    return np.clip(base.astype(np.int32) + noise.astype(np.int32), 0, 255).astype(np.uint8)


@pytest.fixture()
def synthetic_pil_room(synthetic_room_bgr: np.ndarray) -> Image.Image:
    """PIL RGB version of the synthetic room fixture."""
    import cv2

    return Image.fromarray(cv2.cvtColor(synthetic_room_bgr, cv2.COLOR_BGR2RGB))
