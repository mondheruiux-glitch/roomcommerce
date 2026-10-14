# RoomCommerce — Comprehensive Codebase Audit & Technical Reference
## Document 03.4: File-by-File Reference — GPU Worker Pipeline (`workers/gpu-runner`)

> **Subsystem:** Serverless Multimodal GPU Pipeline  
> **Target Cloud:** Modal.com (NVIDIA L4 24GB VRAM)  
> **Runtime:** Python 3.11, CUDA 12.1, PyTorch 2.3+  
> **Total Files:** 23 files  

---

## 1. Pipeline Architecture & Modal Deployment

### [`workers/gpu-runner/modal_app.py`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/workers/gpu-runner/modal_app.py)
* **Layer:** Serverless Cloud Compute Wrapper
* **Primary Responsibility:** Defines the Modal application container, installs system and Python dependencies, mounts persistent model cache volumes (`/root/.cache/huggingface`), downloads model checkpoints during container build, and exposes the `@app.function` and `@web_endpoint` for the NestJS inference processor.
* **Hardware Profile:**
  * GPU: `modal.gpu.L4(count=1)` (24GB VRAM)
  * CPU: 4 vCPU, 16GB System RAM
  * Timeout: 120 seconds
  * Scale-to-Zero: Downscales after 120s of inactivity to eliminate idle infrastructure cost.
* **Deployment CLI:** `modal deploy workers/gpu-runner/modal_app.py`
* **Status:** Verified Active Implementation (Deployment to Modal Cloud pending).

### [`workers/gpu-runner/pyproject.toml`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/workers/gpu-runner/pyproject.toml)
* **Layer:** Python Dependency Specification
* **Key Packages:** `torch`, `torchvision`, `diffusers`, `transformers`, `accelerate`, `opencv-python-headless`, `onnxruntime-gpu`, `modal`, `pillow`, `pydantic`.
* **Status:** Verified Active.

---

## 2. Core Pipeline Services (`src/`)

### [`workers/gpu-runner/src/pipeline_runner.py`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/workers/gpu-runner/src/pipeline_runner.py)
* **Class:** `PipelineRunner`
* **Primary Responsibility:** Orchestrates the 5 stages sequentially, records per-stage microsecond timestamps, tracks GPU compute time, calculates unit cost ($0.85/hr for NVIDIA L4 = $0.000236/sec), and ensures total cost is strictly capped below **$0.040 / run** (enforcing SLA NFR-05).
* **Return Envelope:**
  ```json
  {
    "status": "COMPLETED",
    "rendered_image_b64": "<base64 WebP>",
    "depth_map_b64": "<base64 PNG>",
    "faces_obfuscated": 1,
    "compute_cost_usd": 0.0342,
    "timings": {
      "sanitization_ms": 320,
      "depth_ms": 1840,
      "inpainting_ms": 6120,
      "segmentation_ms": 2310,
      "embedding_ms": 740
    },
    "hotspots": [
      {
        "category": "SOFA",
        "norm_x": 0.452,
        "norm_y": 0.618,
        "crop_embedding": [0.021, -0.045, ...]
      }
    ]
  }
  ```

### [`workers/gpu-runner/src/sanitization.py`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/workers/gpu-runner/src/sanitization.py)
* **Class:** `PrivacySanitizer`
* **Stage 1 Target:** $< 400\text{ms}$
* **Primary Responsibility:** Enforces PRV-01 facial privacy. Loads lightweight OpenCV YuNet ONNX face detection model (`models/face_detection_yunet.onnx`), runs forward inference at multiple scales, detects all human faces, and applies an aggressive $31\times 31$ Gaussian blur to facial bounding boxes.
* **Status:** Verified Functional with ONNX weights present.

### [`workers/gpu-runner/src/depth_service.py`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/workers/gpu-runner/src/depth_service.py)
* **Class:** `DepthEstimator`
* **Stage 2 Target:** $< 2.0\text{s}$
* **Primary Responsibility:** Monocular metric depth extraction using **Depth Anything V2** (Small/Base). Produces high-fidelity 16-bit depth values for spatial conditioning in Stage 3 and an 8-bit normalized PNG depth map for interactive 3D client inspection.
* **Status:** Verified Functional.

### [`workers/gpu-runner/src/inpainting_service.py`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/workers/gpu-runner/src/inpainting_service.py)
* **Class:** `SpatialInpainter`
* **Stage 3 Target:** $< 6.5\text{s}$
* **Primary Responsibility:** Synthesizes photorealistic interior redesigns using Stable Diffusion XL (SDXL) Inpainting coupled with ControlNet Depth. Replaces existing furniture regions while preserving architectural structural boundaries (walls, windows, ceilings, flooring transitions).
* **Conditioning:** Accepts `style_preset` (one of the 8 curated styles) and budget tier.
* **Status:** Verified Functional.

### [`workers/gpu-runner/src/segmentation_extractor.py`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/workers/gpu-runner/src/segmentation_extractor.py)
* **Class:** `FurnitureSegmenter`
* **Stage 4 & 5 Target:** $< 3.3\text{s}$
* **Primary Responsibility:** 
  1. Detects placed furniture elements (sofas, tables, chairs, rugs, lighting, storage) using Grounding DINO and MobileSAM.
  2. Crops semantic bounding regions.
  3. Computes normalized 2D centroids `(norm_x, norm_y)`.
  4. Passes cropped image patches through **SigLIP-SO400M** vision transformer to output 768-dimensional $L_2$-normalized embedding vectors.
* **Status:** Verified Functional.

### [`workers/gpu-runner/src/style_prompts.py`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/workers/gpu-runner/src/style_prompts.py)
* **Primary Responsibility:** Contains expert interior design prompt engineering for all 8 presets (`JAPANDI`, `WARM_MINIMALIST`, `SCANDINAVIAN`, `MID_CENTURY_MODERN`, `INDUSTRIAL_CHIC`, `COASTAL`, `MEDITERRANEAN`, `TRANSITIONAL`) with curated negative prompts eliminating digital artifacts, human figures, distorted geometry, and visual clutter.
* **Status:** Verified Active.

---

## 3. Test Suites & Benchmarks (`tests/`)

* [`tests/test_sanitization.py`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/workers/gpu-runner/tests/test_sanitization.py): Verifies face detection on sample room fixtures and confirms pixel alteration in blurred regions.
* [`tests/test_depth.py`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/workers/gpu-runner/tests/test_depth.py): Asserts depth map dimensions and non-zero gradient across depth planes.
* [`tests/test_embeddings.py`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/workers/gpu-runner/tests/test_embeddings.py): Verifies SigLIP embeddings match 768-dim float32 vectors with $\|v\|_2 \approx 1.0$.
* [`tests/test_pipeline_benchmark.py`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/workers/gpu-runner/tests/test_pipeline_benchmark.py): Measures cold-start vs warm latency and validates SLA constraints.
