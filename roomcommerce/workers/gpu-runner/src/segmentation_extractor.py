"""
segmentation_extractor.py — Stage 4 & 5: Furniture Segmentation & SigLIP Embedding Extraction
Satisfies: FR-302, FR-303, FR-401

FurnitureExtractionService accepts bounding boxes from an upstream segmentation
model (Grounding DINO + MobileSAM — executed in pipeline_runner), crops each
furniture item from the rendered image, encodes through SigLIP-SO400M, applies
L2 normalisation, and computes normalised centroid coordinates.
"""
import torch
import numpy as np
from PIL import Image
from typing import Any, Dict, List
try:
    from transformers import AutoModel, AutoProcessor
except ImportError:
    AutoModel = None
    AutoProcessor = None


class FurnitureExtractionService:
    """Extracts SigLIP embeddings and normalised hotspot pins from furniture crops."""

    _MODEL_ID = "google/siglip-so400m-patch14-384"
    _MIN_CROP_PX = 32  # shortcut: crops < 32px filtered; upgrade threshold if match quality drops

    def __init__(self, device: str = "cuda") -> None:
        self.device = device
        if AutoModel is None or AutoProcessor is None:
            raise ImportError(
                "transformers package is required for FurnitureExtractionService."
            )
        self.processor = AutoProcessor.from_pretrained(self._MODEL_ID)
        self.model = (
            AutoModel.from_pretrained(self._MODEL_ID)
            .to(self.device)
            .eval()
        )

    def extract_detected_items(
        self,
        rendered_image: Image.Image,
        detected_boxes: List[Dict[str, Any]],
        # expected keys per box: category, xmin, ymin, xmax, ymax
    ) -> List[Dict[str, Any]]:
        """Crops items, encodes 768-dim SigLIP embeddings, and computes norm-coords.

        Args:
            rendered_image:  Full-resolution inpainted room render (PIL RGB).
            detected_boxes:  List of dicts with keys: category, xmin, ymin, xmax, ymax.

        Returns:
            List of hotspot dicts:
                {category, norm_x, norm_y, embedding (768-dim list[float]),
                 bounding_box [xmin, ymin, xmax, ymax]}
        """
        w_img, h_img = rendered_image.size

        # Filter and collect valid crops
        crops: List[Image.Image] = []
        valid_items: List[Dict[str, Any]] = []

        for item in detected_boxes:
            xmin, ymin, xmax, ymax = item["xmin"], item["ymin"], item["xmax"], item["ymax"]
            crop_w = xmax - xmin
            crop_h = ymax - ymin
            if crop_w < self._MIN_CROP_PX or crop_h < self._MIN_CROP_PX:
                continue  # noisy micro-crop — discard (FR-302)

            crops.append(rendered_image.crop((xmin, ymin, xmax, ymax)))
            valid_items.append(item)

        if not crops:
            return []

        # Batch-encode through SigLIP (FR-303)
        inputs = self.processor(images=crops, return_tensors="pt").to(self.device)
        with torch.no_grad():
            image_features: torch.Tensor = self.model.get_image_features(**inputs)
            # L2 normalisation — unit-length vectors for Cosine distance in Qdrant
            image_features = image_features / image_features.norm(dim=-1, keepdim=True)

        embeddings: List[List[float]] = image_features.cpu().float().numpy().tolist()

        hotspots: List[Dict[str, Any]] = []
        for idx, item in enumerate(valid_items):
            # Normalised centroid coordinates clamped to [0.0, 1.0] (FR-401)
            norm_x = round(
                max(0.0, min(1.0, (item["xmin"] + item["xmax"]) / (2.0 * w_img))), 4
            )
            norm_y = round(
                max(0.0, min(1.0, (item["ymin"] + item["ymax"]) / (2.0 * h_img))), 4
            )

            hotspots.append(
                {
                    "category": item["category"],
                    "norm_x": norm_x,
                    "norm_y": norm_y,
                    "embedding": embeddings[idx],
                    "bounding_box": [item["xmin"], item["ymin"], item["xmax"], item["ymax"]],
                }
            )

        return hotspots
