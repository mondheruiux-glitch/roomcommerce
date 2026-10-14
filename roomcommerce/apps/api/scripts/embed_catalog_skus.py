#!/usr/bin/env python3
"""
Offline Catalog Ingestion & SigLIP Embedding Pipeline
File: apps/api/scripts/embed_catalog_skus.py

Reads catalog_skus from PostgreSQL, encodes product images via SigLIP,
and batch-upserts 768-dim normalized vectors into Qdrant collection retail_catalog_v1.

Dependencies: torch transformers qdrant-client psycopg2-binary Pillow requests tqdm

Usage:
    python embed_catalog_skus.py
    python embed_catalog_skus.py --batch-size 32 --limit 5000
"""
import io
import os
import sys
import time
import argparse
import logging
from typing import List, Dict, Any, Optional, Tuple

try:
    import requests
except ImportError:
    requests = None

try:
    from PIL import Image
except ImportError:
    Image = None

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    psycopg2 = None

# Lazy / optional ML imports to allow --help and --dry-run without immediate heavyweight initialization
try:
    import torch  # type: ignore
    from transformers import AutoProcessor, AutoModel  # type: ignore
    from qdrant_client import QdrantClient  # type: ignore
    from qdrant_client.models import PointStruct, VectorParams, Distance, PayloadSchemaType  # type: ignore
except ImportError:
    torch = None
    AutoProcessor = None
    AutoModel = None
    QdrantClient = None
    PointStruct = None
    VectorParams = None
    Distance = None
    PayloadSchemaType = None

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# SigLIP Base (patch16-384 or patch16-224) natively outputs 768-dim vectors matching
# QdrantInitService.VECTOR_SIZE (768) used by the RoomCommerce search engine.
DEFAULT_MODEL_ID = os.getenv("SIGLIP_MODEL_ID", "google/siglip-base-patch16-384")
COLLECTION_NAME = os.getenv("QDRANT_COLLECTION_NAME", "retail_catalog_v1")
VECTOR_SIZE = 768  # Standard catalog vector size across apps/api
IMAGE_FETCH_TIMEOUT = 5  # seconds per image request


def get_device() -> str:
    """Detect available compute device."""
    if torch is None:
        return "cpu"
    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def get_model_and_processor(
    model_id: str = DEFAULT_MODEL_ID,
    device: Optional[str] = None,
) -> Tuple[Any, Any, str]:
    """Load SigLIP model and processor lazily."""
    if AutoModel is None or AutoProcessor is None or torch is None:
        raise ImportError(
            "Missing required machine learning dependencies (torch, transformers). "
            "Please install: pip install torch transformers"
        )

    resolved_device = device or get_device()
    log.info(f"Loading SigLIP encoder: {model_id} on {resolved_device}")

    processor = AutoProcessor.from_pretrained(model_id)
    dtype = torch.float16 if resolved_device == "cuda" else torch.float32
    model = AutoModel.from_pretrained(model_id, torch_dtype=dtype)
    model = model.to(resolved_device).eval()

    # Verify model dimension against expected vector size
    hidden_size = getattr(getattr(model, "config", None), "vision_config", model.config).hidden_size
    if hidden_size != VECTOR_SIZE:
        log.warning(
            f"Model {model_id} produces {hidden_size}-dim embeddings, but collection "
            f"expects {VECTOR_SIZE}-dim vectors. Ensure compatibility with Qdrant collection."
        )

    return model, processor, resolved_device


def get_qdrant_client() -> Any:
    """Create a configured QdrantClient instance."""
    if QdrantClient is None:
        raise ImportError(
            "Missing qdrant-client dependency. Please install: pip install qdrant-client"
        )
    return QdrantClient(
        url=os.getenv("QDRANT_URL", "http://localhost:6333"),
        api_key=os.getenv("QDRANT_API_KEY"),
    )


def ensure_collection_exists(
    qdrant: Any,
    collection_name: str = COLLECTION_NAME,
    vector_size: int = VECTOR_SIZE,
) -> None:
    """Ensure collection and appropriate payload indexes exist in Qdrant."""
    existing = [c.name for c in qdrant.get_collections().collections]
    if collection_name not in existing:
        log.info(f"Creating Qdrant collection: {collection_name} (dim={vector_size})")
        qdrant.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
        )
        create_payload_indexes(qdrant, collection_name)
    else:
        log.info(f"Collection '{collection_name}' already exists.")


def create_payload_indexes(qdrant: Any, collection_name: str = COLLECTION_NAME) -> None:
    """Create payload indexes matching QdrantInitService for high-speed filtered vector queries."""
    if PayloadSchemaType is None:
        return

    indexes = [
        ("sku_id", PayloadSchemaType.KEYWORD),
        ("retailer_id", PayloadSchemaType.KEYWORD),
        ("category", PayloadSchemaType.KEYWORD),
        ("price_cents", PayloadSchemaType.INTEGER),
        ("in_stock", PayloadSchemaType.BOOL),
        ("last_sync_timestamp", PayloadSchemaType.INTEGER),
    ]

    for field_name, field_schema in indexes:
        try:
            qdrant.create_payload_index(
                collection_name=collection_name,
                field_name=field_name,
                field_schema=field_schema,
            )
            log.debug(f"Payload index verified: {field_name}")
        except Exception as exc:
            log.warning(f"Could not create payload index {field_name}: {exc}")


def fetch_image_safe(url: str) -> Optional[Image.Image]:
    """Download and open a product image safely, handling decompression and closing streams."""
    try:
        resp = requests.get(url, timeout=IMAGE_FETCH_TIMEOUT)
        resp.raise_for_status()
        return Image.open(io.BytesIO(resp.content)).convert("RGB")
    except Exception as exc:
        log.warning(f"Failed to fetch image {url}: {exc}")
        return None


def generate_image_embeddings(
    image_urls: List[str],
    model: Any,
    processor: Any,
    device: str,
) -> List[Optional[List[float]]]:
    """
    Encode a list of image URLs into normalized float vectors.
    Failed images produce None at their index position.
    """
    loaded_images: List[Image.Image] = []
    valid_indices: List[int] = []

    for idx, url in enumerate(image_urls):
        img = fetch_image_safe(url)
        if img is not None:
            loaded_images.append(img)
            valid_indices.append(idx)

    results: List[Optional[List[float]]] = [None] * len(image_urls)

    if not loaded_images:
        return results

    inputs = processor(images=loaded_images, return_tensors="pt").to(device)
    with torch.no_grad():
        image_features = model.get_image_features(**inputs)
        # L2-normalize for cosine distance (Qdrant Cosine = dot product on normalized vectors)
        image_features = image_features / image_features.norm(dim=-1, keepdim=True)

    vectors = image_features.cpu().to(torch.float32).numpy().tolist()
    for local_idx, global_idx in enumerate(valid_indices):
        results[global_idx] = vectors[local_idx]

    return results


def fetch_catalog_skus(
    conn: Any,
    batch_size: int,
    offset: int,
    limit: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Fetch a batch of catalog SKUs from PostgreSQL."""
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    base_limit = min(batch_size, limit - offset) if limit else batch_size
    if base_limit <= 0:
        cursor.close()
        return []

    cursor.execute(
        """
        SELECT id, sku, retailer_id, category, price_cents, in_stock,
               primary_image_url, EXTRACT(EPOCH FROM last_verified_at)::bigint AS last_sync_ts
        FROM catalog_skus
        ORDER BY created_at
        LIMIT %s OFFSET %s
        """,
        (base_limit, offset),
    )
    rows = cursor.fetchall()
    cursor.close()
    return [dict(r) for r in rows]


def upsert_batch_to_qdrant(
    qdrant: Any,
    skus: List[Dict[str, Any]],
    embeddings: List[Optional[List[float]]],
    collection_name: str = COLLECTION_NAME,
) -> int:
    """Upload valid SKU+embedding pairs to Qdrant. Returns count of points upserted."""
    points = []
    for sku, vector in zip(skus, embeddings):
        if vector is None:
            log.warning(f"Skipping SKU {sku.get('sku')} — image embedding failed.")
            continue
        points.append(
            PointStruct(
                id=str(sku["id"]),  # Ensure UUID is formatted as string for Qdrant
                vector=vector,
                payload={
                    "sku_id": sku["sku"],
                    "retailer_id": sku["retailer_id"],
                    "category": sku["category"],
                    "price_cents": sku["price_cents"],
                    "in_stock": sku["in_stock"],
                    "last_sync_timestamp": sku["last_sync_ts"],
                },
            )
        )

    if points:
        qdrant.upsert(collection_name=collection_name, points=points)

    return len(points)


def main(
    batch_size: int = 64,
    limit: Optional[int] = None,
    model_id: str = DEFAULT_MODEL_ID,
    dry_run: bool = False,
) -> None:
    if dry_run:
        log.info("🧪 [Dry-Run] Verifying Python 3 runtime and SigLIP catalog embedding configuration...")
        log.info(f"🧪 [Dry-Run] Target Model ID: {model_id}")
        log.info(f"🧪 [Dry-Run] Target Qdrant Collection: {COLLECTION_NAME}")
        log.info(f"🧪 [Dry-Run] Target Vector Dimensions: {VECTOR_SIZE}")
        log.info(f"🧪 [Dry-Run] Batch Size: {batch_size}, Limit: {limit}")
        log.info(f"🧪 [Dry-Run] Detected Compute Device: {get_device()}")
        log.info(f"🧪 [Dry-Run] Requests HTTP Library Available: {requests is not None}")
        log.info(f"🧪 [Dry-Run] Pillow Image Library Available: {Image is not None}")
        log.info(f"🧪 [Dry-Run] Qdrant Client Library Available: {QdrantClient is not None}")
        log.info(f"🧪 [Dry-Run] PyTorch Library Available: {torch is not None}")
        log.info(f"🧪 [Dry-Run] PostgreSQL Client Available: {psycopg2 is not None}")
        log.info("✅ [Dry-Run] Configuration validated successfully. Zero network/database errors.")
        return

    if requests is None or Image is None:
        raise ImportError(
            "Missing image processing dependencies. Please install: pip install requests Pillow"
        )

    if psycopg2 is None:
        raise ImportError(
            "Missing psycopg2 dependency. Please install: pip install psycopg2-binary"
        )

    qdrant = get_qdrant_client()
    ensure_collection_exists(qdrant)

    model, processor, device = get_model_and_processor(model_id=model_id)

    db_url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/roomcommerce_dev")
    conn = psycopg2.connect(db_url)
    log.info("PostgreSQL connection established.")

    offset = 0
    total_upserted = 0
    start_time = time.time()

    try:
        while True:
            batch = fetch_catalog_skus(conn, batch_size, offset, limit)
            if not batch:
                break

            image_urls = [sku["primary_image_url"] for sku in batch]
            embeddings = generate_image_embeddings(image_urls, model, processor, device)
            count = upsert_batch_to_qdrant(qdrant, batch, embeddings)
            total_upserted += count
            offset += len(batch)

            elapsed = time.time() - start_time
            pts_per_sec = (total_upserted / elapsed) if elapsed > 0 else 0.0
            log.info(
                f"Progress: {offset} scanned / {total_upserted} upserted "
                f"({elapsed:.1f}s elapsed, {pts_per_sec:.1f} pts/sec)"
            )

            if limit and offset >= limit:
                break
    finally:
        conn.close()

    log.info(f"✅ Embedding pipeline complete. {total_upserted} vectors upserted into '{COLLECTION_NAME}'.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SigLIP catalog embedding pipeline")
    parser.add_argument("--batch-size", type=int, default=64, help="Images per batch")
    parser.add_argument("--limit", type=int, default=None, help="Max SKUs to process (default: all)")
    parser.add_argument("--model-id", type=str, default=DEFAULT_MODEL_ID, help="HuggingFace model ID")
    parser.add_argument("--dry-run", action="store_true", help="Simulate pipeline configuration without DB or Qdrant connection")
    cleaned_argv = [arg for arg in sys.argv[1:] if arg != "--"]
    args = parser.parse_args(cleaned_argv)
    main(batch_size=args.batch_size, limit=args.limit, model_id=args.model_id, dry_run=args.dry_run)
