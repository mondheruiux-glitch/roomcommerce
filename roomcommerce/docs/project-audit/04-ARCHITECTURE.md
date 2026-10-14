# RoomCommerce — Comprehensive Codebase Audit & Technical Reference
## Document 04: System Architecture & Technical Topology

> **Audit Date:** October 14, 2026  
> **Status:** Verified Active Implementation  

---

## 1. High-Level System Architecture

RoomCommerce uses a **modular monolith backend** paired with an **App Router frontend**, a **serverless multimodal GPU fleet**, and **decoupled storage/vector clusters**.

```mermaid
graph TB
    subgraph Client ["Client Browser (Next.js 15 / React 19)"]
        UI["Atelier Design System UI\n(@roomcommerce/ui)"]
        Canvas["Konva 3D Spatial Canvas\n(normX, normY Hotspots)"]
        WASM["Client-Side EXIF Scrubber\n(PRV-01: 0% GPS Leakage)"]
        Store["Zustand Stores\n(Wizard, Canvas, Auth)"]
    end

    subgraph Edge ["Cloudflare Edge Network"]
        WAF["Cloudflare WAF & DDoS Shield"]
        Canary["Canary Router Worker\n(10% -> 50% -> 100% Split)"]
    end

    subgraph Compute ["AWS ECS Fargate Cluster"]
        API["NestJS 10 Modular Monolith\n(4000: HTTP REST & SSE)"]
        WebECS["Next.js Web Server\n(3000: SSR & Static Pages)"]
    end

    subgraph Queue ["Redis Cluster (BullMQ)"]
        PaidQ["Queue: Paid Move-In Pass\n(Priority 1: High)"]
        FreeQ["Queue: Free Tier\n(Priority 10: Standard)"]
    end

    subgraph GPUWorker ["Serverless GPU Fleet (Modal.com)"]
        L4["NVIDIA L4 24GB VRAM\n(PyTorch, CUDA 12.1)"]
        Stage1["1. YuNet Face Blur\n(<400ms, 31x31 Gaussian)"]
        Stage2["2. Depth Anything V2\n(<2.0s, Metric Depth)"]
        Stage3["3. SDXL ControlNet\n(<6.5s Inpainting)"]
        Stage4["4. MobileSAM Seg\n(<2.5s Furniture Crop)"]
        Stage5["5. SigLIP 768-dim\n(<800ms Embeddings)"]
    end

    subgraph Storage ["Cloud Storage & Databases"]
        R2["Cloudflare R2 Bucket\n(7-Day Auto Purge Rule)"]
        Postgres["AWS Aurora PostgreSQL 16\n(Drizzle ORM)"]
        Qdrant["Qdrant Cloud Vector DB\n(retail_catalog_v1: HNSW Cosine)"]
    end

    subgraph External ["External Service Integrations"]
        Stripe["Stripe Checkout & Webhooks\n($14.99 Move-In Pass)"]
        PostHog["PostHog HTTP Telemetry\n(SHA-256 Anonymized)"]
        Merchants["Retail Merchants\n(Amazon, Wayfair, IKEA, Target)"]
    end

    Client -->|HTTPS / WSS| Edge
    WAF --> Canary
    Canary -->|Weighted| API
    Canary -->|Weighted| WebECS
    API -->|Enqueue Jobs| Queue
    API -->|SSE Events| Client
    API -->|Presigned Uploads| R2
    API -->|Drizzle SQL| Postgres
    API -->|Dispatches Job| GPUWorker
    L4 --> Stage1 --> Stage2 --> Stage3 --> Stage4 --> Stage5
    Stage5 -->|Returns Base64 & Vectors| API
    API -->|Vector Similarity Search| Qdrant
    API -->|Outbound Deep-links| Merchants
    API -->|Checkout Sessions| Stripe
    API -->|Event Capture| PostHog
```

---

## 2. Application Entry Points & Initialization Order

### 2.1 Backend Initialization (`apps/api/src/main.ts`)
1. **Reflect Metadata:** Loads `reflect-metadata` for NestJS decorators.
2. **NestFactory Creation:** Boots `AppModule` with `bodyParser: false` to allow custom raw body capture.
3. **HTTP Security (Helmet):** Injects strict CSP, HSTS, cross-origin resource policies, and disallows iframe embedding.
4. **Raw Body Buffering:** Configures custom `express.json` parser capturing raw bytes on `/webhook` routes for cryptographic Stripe signature verification.
5. **CORS & Cookies:** Binds CORS origin list and parses signed cookies with `env.COOKIE_SECRET`.
6. **Global Pipes:** Installs `ValidationPipe` with strict DTO whitelisting.
7. **Filters & Interceptors:** Registers `GlobalExceptionFilter` (contract error envelopes) and `TransformResponseInterceptor` (contract success envelopes).
8. **Port Listen:** Binds to `env.PORT` (4000) and begins handling requests.

### 2.2 Frontend Initialization (`apps/web/src/app/layout.tsx`)
1. **Font Loading:** Streams Plus Jakarta Sans and JetBrains Mono from Google Fonts with swap display.
2. **CSS Variables & Tokens:** Applies Atelier Design System CSS variables to root `<html>` element.
3. **Notification Provider:** Mounts Sonner toast container at top-right viewport.
4. **Layout Scaffolding:** Renders global sticky `Header` (navigation, credits counter, profile) and main viewport `<main>`.

---

## 3. End-to-End Request & Data Flows

### 3.1 Spatial Redesign Render Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as User Browser
    participant API as NestJS API
    participant R2 as Cloudflare R2
    participant BullMQ as Redis / BullMQ
    participant Modal as Modal GPU Worker
    participant Qdrant as Qdrant Vector Cloud
    participant DB as PostgreSQL 16

    User->>API: POST /api/v1/projects (Style, Budget, Room Type)
    API->>DB: INSERT into projects (status='CREATED')
    API-->>User: 201 Created { projectId, presignedUploadUrl, assetKey }
    User->>R2: PUT presigned upload (scrubbed image bytes)
    User->>API: POST /api/v1/projects/:id/render
    API->>BullMQ: Enqueue job (inference-jobs, priority by pass)
    API-->>User: 202 Accepted { jobId, sseStreamUrl }
    
    User->>API: GET /api/v1/inference/:id/sse
    Note over User,API: SSE stream established

    BullMQ->>API: InferenceProcessor dequeues job
    API->>R2: Download raw image bytes
    API-->>User: SSE: SANITIZATION (15%)
    API-->>User: SSE: DEPTH_ESTIMATION (35%)
    
    API->>Modal: POST /render (image + style_preset + budget)
    Modal->>Modal: Execute Stages 1-5 (<13s)
    Modal-->>API: 200 OK { rendered_image_b64, depth_map_b64, hotspots }
    
    API-->>User: SSE: INPAINTING (65%)
    API->>R2: Upload rendered WebP & depth PNG
    API-->>User: SSE: SEGMENTATION (80%)
    API-->>User: SSE: CATALOG_MATCHING (90%)
    
    loop For each detected furniture hotspot
        API->>Qdrant: Search top-1 SKU (category + budget <= ceiling)
        Qdrant-->>API: Match SKU ID & similarity score
        API->>DB: INSERT into canvas_hotspots
    end
    
    API->>DB: UPDATE projects (status='COMPLETED', urls)
    API-->>User: SSE: COMPLETE { renderedImageUrl, hotspots }
```

---

## 4. Architectural Boundaries & Coupling Analysis

| Boundary | Interaction Method | Coupling Assessment | Health Score |
| :--- | :--- | :--- | :--- |
| **Web ➔ API** | Type-safe REST client wrapping `@roomcommerce/contracts` envelopes | Low coupling; contracts shared via package | 9.5 / 10 |
| **API ➔ Modal GPU** | HTTP POST multipart/form-data via bearer token auth | Low coupling; serverless scaling | 9.0 / 10 |
| **API ➔ PostgreSQL** | Drizzle ORM strongly-typed schema (`db.query`) | Strong typing; compile-time verified | 9.8 / 10 |
| **API ➔ Qdrant** | Qdrant JS SDK over HTTPS with payload filtering | Decoupled; isolated vector collection | 9.2 / 10 |
| **API ➔ Redis** | BullMQ queue producer / consumer | Asynchronous; worker runs in process or external | 9.4 / 10 |
| **API ➔ Retailers** | Standardized `IStockCheckerAdapter` via `CompositeStockCheckerAdapter` | Clean polymorphic abstraction; easily extensible | 9.5 / 10 |

---

## 5. Architectural Risks & Failure Modes

1. **Modal Cloud Outage:** If Modal.com experiences downtime or cold-start timeouts (>90s), the `InferenceProcessor` abort controller cancels the request, sets the project state to `FAILED`, and sends an error SSE event so the frontend does not hang indefinitely.
2. **Qdrant Unavailability:** If Qdrant is unreachable during hotspot mapping, `InferenceProcessor` catches the exception per hotspot and falls back to top in-stock catalog SKUs from PostgreSQL, ensuring user renders never fail catastrophically due to vector index outages.
3. **Retailer API Degradation:** Amazon PA-API and Wayfair rate limits are guarded by circuit breaker monitors (`circuit-breaker-monitor.ts`) that fail open (`inStock=true`) to prevent legitimate products from being erroneously de-indexed during transient merchant API outages.
