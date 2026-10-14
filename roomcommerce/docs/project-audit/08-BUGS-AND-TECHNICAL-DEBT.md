# RoomCommerce — Comprehensive Codebase Audit & Technical Reference
## Document 08: Bugs, Defects & Technical Debt Ledger

> **Audit Date:** October 14, 2026
> **Last Updated:** October 14, 2026 (Wave 6 — Final verification pass)
> **Status:** All Wave 1–6 items resolved and verified

---

## 1. Confirmed Operational Defects & Environment Mismatches

### [`BUG-001`] Host Environment Python Alias Mismatch
* **Severity:** Medium (Operational Blocker)
* **Status:** ✅ **RESOLVED & VERIFIED** (Wave 1)
* **Evidence:** Running `python apps/api/scripts/embed_catalog_skus.py` returned:
  ```
  zsh: command not found: python
  ```
* **Root Cause:** Modern macOS (macOS 12.3+ / Ventura / Sonoma / Sequoia) removed the legacy `/usr/bin/python` binary alias. The host environment only exposes `python3`.
* **Impact:** Operators or scripts invoking `python` directly fail immediately.
* **Resolution Applied:**
  1. `apps/api/package.json` now declares `"catalog:embed": "python3 scripts/embed_catalog_skus.py"`.
  2. Root `package.json` delegates via `"api:embed": "pnpm --filter @roomcommerce/api run catalog:embed"`.
  3. Python shebang lines use `#!/usr/bin/env python3`.
  4. `pnpm preflight` (Gate 6) now reports Modal mock vs live status on every run.

---

### [`BUG-002`] Modal CLI Absence in Global User PATH
* **Severity:** Medium (Deployment Blocker)
* **Status:** ✅ **RESOLVED & VERIFIED** (Wave 1 + Wave 3)
* **Evidence:** Running `modal deploy workers/gpu-runner/modal_app.py` returned:
  ```
  zsh: command not found: modal
  ```
* **Root Cause:** The `modal` Python package was not installed globally or was inside an inactive virtualenv.
* **Impact:** Serverless GPU workers cannot be deployed to Modal Cloud from the host without installing the CLI.
* **Resolution Applied:**
  1. Root `package.json` now declares `"gpu:deploy": "python3 -m modal deploy workers/gpu-runner/modal_app.py"` (uses `python3 -m modal` to bypass PATH issues).
  2. `InferenceProcessor` hardened with dual-mode execution: `MODAL_MOCK_MODE=true` runs local stubs; live mode hits the deployed Modal endpoint.
  3. `pnpm preflight` (Gate 6) detects mock mode vs live `.modal.run` endpoint and prints the deploy command.
  4. Install docs: `pip3 install --user modal && python3 -m modal setup`.

---

### [`BUG-003`] Pnpm Binary Script Invocation Syntax
* **Severity:** Low (Operational Friction)
* **Status:** ✅ **RESOLVED & VERIFIED** (Wave 1)
* **Evidence:** Running `pnpm --filter @roomcommerce/api ts-node scripts/configure-r2-lifecycle.ts` returned:
  ```
  None of the selected packages has a "ts-node" script
  ```
* **Root Cause:** In pnpm, commands following `--filter <package>` look for a named lifecycle script in `package.json["scripts"]`. `ts-node` is a binary dependency in `node_modules/.bin/`, not a named script.
* **Impact:** Manual execution of maintenance scripts fails unless called with `exec` or defined in `package.json`.
* **Resolution Applied:**
  All convenience scripts registered in `apps/api/package.json`:
  ```json
  "db:generate":          "drizzle-kit generate",
  "db:migrate":           "drizzle-kit migrate",
  "catalog:seed":         "tsx src/modules/catalog/seed/seed-runner.ts",
  "catalog:embed":        "python3 scripts/embed_catalog_skus.py",
  "r2:lifecycle":         "tsx scripts/configure-r2-lifecycle.ts",
  "circuit-breaker:eval": "SINGLE_SHOT=true tsx scripts/circuit-breaker-monitor.ts",
  "preflight":            "tsx scripts/preflight-verify.ts"
  ```
  And in root `package.json` as top-level aliases via `pnpm --filter @roomcommerce/api run <script>`.

---

## 2. Technical Debt & Architectural Gaps

### [`DEBT-001`] Target and IKEA Merchant Stock Adapters
* **Severity:** Low (Feature Enhancement)
* **Status:** ✅ **RESOLVED & VERIFIED** (Wave 2)
* **Previous State:** `CompositeStockCheckerAdapter` had dedicated integrations only for `AMAZON` and `WAYFAIR`. Retailers `TARGET` and `IKEA` hit the safe fail-open fallback (`inStock: true`).
* **Technical Debt:** Out-of-stock TARGET and IKEA items would not be de-indexed during nightly sync.
* **Resolution Applied:**
  1. `apps/api/src/modules/catalog/sync/adapters/target.adapter.ts` — `TargetStockCheckerAdapter` implementing `IStockCheckerAdapter` via RedCircle API with UTM affiliate tracking (`roomcommerce_target`).
  2. `apps/api/src/modules/catalog/sync/adapters/ikea.adapter.ts` — `IkeaStockCheckerAdapter` implementing `IStockCheckerAdapter` via IKEA Ingka Availability API with affiliate deep-link spec.
  3. Both adapters registered in `CompositeStockCheckerAdapter` router.
  4. `test/catalog/catalog-sync.test.ts` extended with TARGET and IKEA routing tests.

---

### [`DEBT-002`] Vendor Directory Size in Monorepo Root
* **Severity:** Low (Repository Weight)
* **Current State:** `roomcommerce/vendor/react-bits/` contains 6,297 files. While `@roomcommerce/ui` only imports a small handful of components, the entire upstream react-bits source repository is stored in `vendor/`.
* **Status:** 🟡 **DEFERRED** — Non-blocking for production launch. Scheduled for post-launch housekeeping sprint.
* **Technical Debt:** Increases repository file count, lengthens global searches, and inflates IDE indexing times.
* **Remediation:** Prune unused components from `vendor/react-bits/` or publish consumed components directly into `@roomcommerce/ui/src/react-bits/` and remove unused upstream files.

---

### [`DEBT-003`] Qdrant Cloud Production Infrastructure Provisioning
* **Severity:** Medium (Production Requirement)
* **Current State:** `QdrantInitService` and `VectorRetrievalService` read `QDRANT_URL` and `QDRANT_API_KEY` from environment variables. In test and local development, mock endpoints or local Docker instances are used.
* **Status:** 🟡 **PENDING** — Cloud cluster provisioning is a deployment step (TASK-005), not a code change. `pnpm preflight` (Gate 4) now reports collection status on every run.
* **Technical Debt:** A managed cluster on [cloud.qdrant.io](https://cloud.qdrant.io) must be provisioned and seeded before production traffic cutover.
* **Remediation:** `pnpm api:embed` seeds `retail_catalog_v1` with 50K vectors once a live cluster URL is in AWS SSM.
