#!/usr/bin/env python3
"""
modal_app.py — RoomCommerce GPU Runner
Modal serverless container definition targeting NVIDIA L4 (24GB VRAM) with
pre-baked model weights to eliminate cold-start download latency.

Web endpoint: POST /render
  Authorization: Bearer <MODAL_API_TOKEN>
  Content-Type:  application/json
  Body (JSON):
    {
      "project_id":             string,
      "raw_image_url":          string,      -- R2 public URL to the raw room photo
      "style_preset":           string,      -- one of the 8 style keys (e.g. "JAPANDI")
      "room_function":          string,      -- e.g. "LIVING_ROOM"
      "budget_ceiling_cents":   int,         -- default: 150000
      "locked_anchor_categories": [string]  -- US-03: categories excluded from replacement
    }
  Response (JSON):
    { "result": <ModalPipelineResult> }

  ModalPipelineResult:
    {
      "status":               "COMPLETED" | "FAILED",
      "rendered_image_b64":   string | null,  -- base64 WebP
      "depth_map_b64":        string | null,  -- base64 PNG
      "hotspots": [
        {
          "category":      string,
          "norm_x":        float,
          "norm_y":        float,
          "crop_embedding": [float x 768],
          "bounding_box":  { "xmin", "ymin", "xmax", "ymax" }
        }
      ],
      "timings":             { [stage: string]: float },
      "compute_cost_usd":    float,
      "faces_obfuscated":    int,
      "error_code":          string | null,
      "message":             string | null
    }
"""
import base64
import io
import os

import modal

app = modal.App("roomcommerce-gpu-runner")

# ---------------------------------------------------------------------------
# Container image: Debian Slim + CUDA 12.4 + pinned ML deps + cached weights
# ---------------------------------------------------------------------------
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "ffmpeg", "libsm6", "libxext6")
    # PyTorch with CUDA 12.4 must be installed before other packages
    # that may pull a CPU-only wheel via their own requirements.
    .pip_install(
        "torch==2.4.1+cu124",
        "torchvision==0.19.1+cu124",
        extra_index_url="https://download.pytorch.org/whl/cu124",
    )
    .pip_install(
        "diffusers==0.30.3",
        "transformers==4.45.2",
        "accelerate==0.34.2",
        "opencv-python-headless==4.10.0.84",
        "pillow==10.4.0",
        "numpy==1.26.4",
        "qdrant-client==1.11.3",
        "boto3==1.35.32",
        "safetensors==0.4.5",
        "httpx==0.27.2",
    )
    # Pre-download and cache all model weights during image build so that
    # warm instances start inference immediately (NFR-01 cold-start target ≤25s).
    .run_commands(
        "python -c \"\""
        "from transformers import AutoImageProcessor, AutoModelForDepthEstimation; "
        "AutoImageProcessor.from_pretrained('depth-anything/Depth-Anything-V2-Base-hf'); "
        "AutoModelForDepthEstimation.from_pretrained('depth-anything/Depth-Anything-V2-Base-hf')"
        "\"\"",
        "python -c \"\""
        "from transformers import AutoProcessor, AutoModel; "
        "AutoProcessor.from_pretrained('google/siglip-so400m-patch14-384'); "
        "AutoModel.from_pretrained('google/siglip-so400m-patch14-384')"
        "\"\"",
        "python -c \"\""
        "from diffusers import ControlNetModel; "
        "ControlNetModel.from_pretrained('diffusers/controlnet-depth-sdxl-1.0', torch_dtype=__import__('torch').float16)"
        "\"\"",
        "python -c \"\""
        "from diffusers import StableDiffusionXLControlNetInpaintPipeline; "
        "StableDiffusionXLControlNetInpaintPipeline.from_pretrained("
        "    'diffusers/stable-diffusion-xl-1.0-inpainting-0.1', torch_dtype=__import__('torch').float16, variant='fp16'"
        ")"
        "\"\"",
    )
)

GPU_CONFIG = modal.gpu.L4()  # 24 GB GDDR6 — target hardware (NFR-04, NFR-05)

# ---------------------------------------------------------------------------
# Secret for Bearer token auth (set via `modal secret create roomcommerce-api
# MODAL_API_TOKEN=<value>` before deploying)
# ---------------------------------------------------------------------------
_API_SECRET = modal.Secret.from_name("roomcommerce-api", required=False)


@app.function(image=image, gpu=GPU_CONFIG, timeout=120, concurrency_limit=50)
def run_pipeline(
    input_image_bytes: bytes,
    style_preset: str,
    budget_cents: int = 150000,
    locked_anchor_categories: list[str] | None = None,
) -> dict:
    """Internal GPU function — chains Sanitization → Depth → Inpainting → Segmentation."""
    import cv2
    import numpy as np

    from .src.pipeline_runner import SpatialPipelineRunner

    # Decode bytes → NumPy BGR (matches OpenCV convention used throughout pipeline)
    nparr = np.frombuffer(input_image_bytes, np.uint8)
    img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    runner = SpatialPipelineRunner()
    raw = runner.execute_job_from_array(img_bgr, style_preset, budget_cents)

    # -----------------------------------------------------------------------
    # Encode binary outputs as base64 so the JSON response is wire-safe.
    # -----------------------------------------------------------------------
    if raw.get("rendered_image") is not None:
        rendered_bytes: bytes = raw["rendered_image"]
        raw["rendered_image_b64"] = base64.b64encode(rendered_bytes).decode("utf-8")
        del raw["rendered_image"]

    if raw.get("depth_map") is not None:
        depth_bytes: bytes = raw["depth_map"]
        raw["depth_map_b64"] = base64.b64encode(depth_bytes).decode("utf-8")
        del raw["depth_map"]

    return raw


# ---------------------------------------------------------------------------
# HTTPS web endpoint — called by NestJS inference.processor.ts
#
# POST /render
#   Authorization: Bearer <MODAL_API_TOKEN>
#   Content-Type:  application/json
#   Body:          see module docstring for full JSON schema
# ---------------------------------------------------------------------------
@app.function(image=image, gpu=GPU_CONFIG, timeout=120, concurrency_limit=50, secrets=[_API_SECRET])
@modal.web_endpoint(method="POST", label="render")
async def render_endpoint(request) -> dict:
    """
    HTTPS entry point invoked by the NestJS BullMQ processor.

    Accepts:  JSON body (see module docstring)
    Returns:  { "result": <ModalPipelineResult> }
    """
    from fastapi import HTTPException
    import httpx

    # ------------------------------------------------------------------
    # 1. Bearer token authentication
    # ------------------------------------------------------------------
    expected_token = os.environ.get("MODAL_API_TOKEN", "")
    auth_header = request.headers.get("Authorization", "")
    if expected_token and auth_header != f"Bearer {expected_token}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    # ------------------------------------------------------------------
    # 2. Parse JSON body
    # ------------------------------------------------------------------
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Request body must be valid JSON.")

    project_id: str = body.get("project_id", "")
    raw_image_url: str = body.get("raw_image_url", "")
    style_preset: str = body.get("style_preset", "MODERN")
    budget_ceiling_cents: int = int(body.get("budget_ceiling_cents", 150000))
    locked_anchor_categories: list[str] = body.get("locked_anchor_categories", [])

    if not raw_image_url:
        raise HTTPException(status_code=400, detail="Missing required field: raw_image_url")

    # ------------------------------------------------------------------
    # 3. Fetch raw image from the R2 public URL
    # ------------------------------------------------------------------
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            img_response = await client.get(raw_image_url)
            img_response.raise_for_status()
            image_bytes = img_response.content
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Failed to fetch raw_image_url: {exc}")

    if not image_bytes:
        raise HTTPException(status_code=422, detail="Image fetched from raw_image_url was empty.")

    # ------------------------------------------------------------------
    # 4. Dispatch to GPU function (runs on the same L4 instance pool)
    # ------------------------------------------------------------------
    result = run_pipeline.remote(
        image_bytes,
        style_preset,
        budget_ceiling_cents,
        locked_anchor_categories,
    )

    return {"result": result}


# ---------------------------------------------------------------------------
# Benchmark function (unchanged)
# ---------------------------------------------------------------------------
@app.function(image=image, gpu=GPU_CONFIG, timeout=300)
def benchmark_pipeline(iterations: int = 10) -> list:
    """Warmup benchmark — run N iterations and return timing/cost/VRAM stats."""
    import numpy as np
    from PIL import Image

    from .src.pipeline_runner import SpatialPipelineRunner

    # Synthetic 1024×1024 room image in memory to avoid fixture file dependency
    synthetic = Image.fromarray(np.random.randint(80, 200, (1024, 1024, 3), dtype=np.uint8))
    buf = io.BytesIO()
    synthetic.save(buf, format="JPEG")
    img_bytes = buf.getvalue()

    results = []
    for _ in range(iterations):
        result = run_pipeline.local(img_bytes, "JAPANDI", 150000)
        results.append(
            {
                "total_latency_ms": result.get("timings", {}).get("total_latency_ms"),
                "compute_cost_usd": result.get("compute_cost_usd"),
            }
        )
    return results
