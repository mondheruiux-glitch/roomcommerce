"""
test_depth.py — Unit tests for DepthEstimationService
GPU tests are skipped on CPU-only machines; shape & format checks run always.
"""
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np
import pytest
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent.parent))


# ---------------------------------------------------------------------------
# CPU-only smoke tests using mocked transformers classes
# ---------------------------------------------------------------------------


class TestDepthMapContract:
    """Verify output shape and colour-mode contract without a GPU."""

    def _make_mock_depth_service(self, input_size: tuple[int, int] = (1024, 768)):
        """Build DepthEstimationService with all HuggingFace calls mocked out."""
        with (
            patch("src.depth_service.AutoImageProcessor") as MockProc,
            patch("src.depth_service.AutoModelForDepthEstimation") as MockModel,
        ):
            import torch

            # Processor mock
            mock_processor_inst = MagicMock()
            w, h = input_size

            def fake_process(images, return_tensors):
                class _Batch:
                    def to(self, device):
                        return self

                    def __iter__(self):
                        return iter([])

                    def keys(self):
                        return []

                return _Batch()

            mock_processor_inst.side_effect = fake_process
            MockProc.from_pretrained.return_value = mock_processor_inst

            # Model mock — returns a fake predicted_depth tensor of (1, h, w)
            mock_model_inst = MagicMock()
            mock_model_inst.to.return_value = mock_model_inst
            mock_model_inst.eval.return_value = mock_model_inst
            fake_depth = torch.ones(1, h // 14, w // 14)  # typical ViT patch output

            class _Out:
                predicted_depth = fake_depth

            mock_model_inst.return_value = _Out()
            MockModel.from_pretrained.return_value = mock_model_inst

            from src.depth_service import DepthEstimationService

            return DepthEstimationService(device="cpu"), (h, w)

    def test_output_is_pil_rgb(self) -> None:
        svc, (h, w) = self._make_mock_depth_service((512, 512))
        pil_in = Image.fromarray(np.zeros((512, 512, 3), dtype=np.uint8))

        # Patch the model call to avoid real inference
        import torch
        from unittest.mock import patch as _patch

        fake_depth = torch.rand(1, 37, 37)  # ~512/14

        class _Out:
            predicted_depth = fake_depth

        with _patch.object(svc.model, "__call__", return_value=_Out()):
            depth_map = svc.generate_depth_map(pil_in)

        assert isinstance(depth_map, Image.Image), "Output must be PIL Image"
        assert depth_map.mode == "RGB", f"Expected RGB, got {depth_map.mode}"

    def test_output_dimensions_match_input(self) -> None:
        """Depth map must be bicubic-upsampled back to the original input dimensions."""
        import torch
        from unittest.mock import patch as _patch

        svc, _ = self._make_mock_depth_service((768, 512))
        pil_in = Image.fromarray(np.zeros((512, 768, 3), dtype=np.uint8))

        fake_depth = torch.rand(1, 37, 55)  # approximate patch grid

        class _Out:
            predicted_depth = fake_depth

        with _patch.object(svc.model, "__call__", return_value=_Out()):
            depth_map = svc.generate_depth_map(pil_in)

        assert depth_map.size == pil_in.size, (
            f"Depth map size {depth_map.size} != input size {pil_in.size}"
        )

    def test_output_pixel_range_is_uint8(self) -> None:
        """All pixel values must be in [0, 255]."""
        import torch
        from unittest.mock import patch as _patch

        svc, _ = self._make_mock_depth_service((512, 512))
        pil_in = Image.fromarray(np.zeros((512, 512, 3), dtype=np.uint8))
        fake_depth = torch.rand(1, 37, 37)

        class _Out:
            predicted_depth = fake_depth

        with _patch.object(svc.model, "__call__", return_value=_Out()):
            depth_map = svc.generate_depth_map(pil_in)

        arr = np.array(depth_map)
        assert arr.min() >= 0
        assert arr.max() <= 255
        assert arr.dtype == np.uint8

    def test_three_channels(self) -> None:
        """ControlNet requires exactly 3 channels."""
        import torch
        from unittest.mock import patch as _patch

        svc, _ = self._make_mock_depth_service((512, 512))
        pil_in = Image.fromarray(np.zeros((512, 512, 3), dtype=np.uint8))
        fake_depth = torch.rand(1, 37, 37)

        class _Out:
            predicted_depth = fake_depth

        with _patch.object(svc.model, "__call__", return_value=_Out()):
            depth_map = svc.generate_depth_map(pil_in)

        arr = np.array(depth_map)
        assert arr.ndim == 3, "Depth map must be 3-dimensional (H, W, C)"
        assert arr.shape[2] == 3, f"Expected 3 channels, got {arr.shape[2]}"
