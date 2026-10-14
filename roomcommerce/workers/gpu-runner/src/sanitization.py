"""
sanitization.py — Stage 1: Edge Validation & Privacy Obfuscation
Satisfies: SEC-02, FR-105

Enforces image quality gates (resolution, sharpness, exposure) and applies
an irreversible Gaussian blur to all detected human faces using OpenCV YuNet.
"""
import cv2
import numpy as np
from pathlib import Path
from typing import Tuple


class ImageSanitizationService:
    def __init__(self, yunet_model_path: str = "models/face_detection_yunet.onnx") -> None:
        p = Path(yunet_model_path)
        if not p.is_file():
            fallback = Path(__file__).resolve().parent.parent / yunet_model_path
            if fallback.is_file():
                p = fallback
        # YuNet ONNX face detector — lazy creation; input_size is overridden per-frame
        self.detector = cv2.FaceDetectorYN.create(
            model=str(p),
            config="",
            input_size=(320, 320),
            score_threshold=0.6,
            nms_threshold=0.3,
            top_k=5000,
        )

    # ------------------------------------------------------------------
    # Quality gate (FR-105)
    # ------------------------------------------------------------------

    def validate_quality_gate(self, image_bgr: np.ndarray) -> Tuple[bool, str]:
        """Validates resolution, sharpness, and exposure.

        Returns:
            (True, "PASSED") if image passes all checks.
            (False, human-actionable message) on the first failing check.
        """
        h, w = image_bgr.shape[:2]
        if h < 512 or w < 512:
            return False, "Resolution too low. Image must be at least 512×512 pixels."

        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)

        # Laplacian variance — low value signals motion blur or camera shake
        lap_var: float = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        if lap_var < 100.0:
            return False, "Image is excessively blurry. Please hold steady and retake."

        # Mean luminance — guards under/over exposure
        mean_brightness: float = float(np.mean(gray))
        if mean_brightness < 40.0:
            return False, "Image is under-illuminated. Turn on room lights and retake."
        if mean_brightness > 230.0:
            return False, "Image is over-exposed. Avoid pointing directly at bare light fixtures."

        return True, "PASSED"

    # ------------------------------------------------------------------
    # Face obfuscation (SEC-02)
    # ------------------------------------------------------------------

    def obfuscate_biometrics(self, image_bgr: np.ndarray) -> Tuple[np.ndarray, int]:
        """Detects human faces and applies an irreversible 31×31 Gaussian blur (SEC-02).

        Args:
            image_bgr: Input frame in BGR colour order.

        Returns:
            (sanitized_image_bgr, count_of_blurred_faces)
        """
        h, w = image_bgr.shape[:2]
        self.detector.setInputSize((w, h))
        _, faces = self.detector.detect(image_bgr)

        sanitized = image_bgr.copy()
        faces_blurred = 0

        if faces is not None:
            for face in faces:
                x, y, fw, fh = map(int, face[:4])
                # 10 px outer margin for hairline / ears (SEC-02 specification)
                x = max(0, x - 10)
                y = max(0, y - 10)
                fw = min(w - x, fw + 20)
                fh = min(h - y, fh + 20)

                roi = sanitized[y : y + fh, x : x + fw]
                if roi.size > 0:
                    # 31×31 kernel — large enough to guarantee irrecoverable feature blur
                    blurred_roi = cv2.GaussianBlur(roi, (31, 31), 0)
                    sanitized[y : y + fh, x : x + fw] = blurred_roi
                    faces_blurred += 1

        return sanitized, faces_blurred
