# RoomCommerce — Comprehensive Codebase Audit & Technical Reference
## Document 15: File-Level Change & Patch Execution Plan

> **Audit Date:** October 14, 2026  
> **Status:** Detailed Patch Plans Ready for Authorized Execution  

---

## 1. Patch Plan: `FIX-001` Package Script Aliases

### Objective
Add direct script entries in `apps/api/package.json` to allow operational scripts to run seamlessly via `pnpm run <script>`.

### Existing Problem & Evidence
Running `pnpm --filter @roomcommerce/api ts-node scripts/configure-r2-lifecycle.ts` fails with:
`None of the selected packages has a "ts-node" script`.

### Proposed Implementation
In [`apps/api/package.json`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/package.json), add under `"scripts"`:
```json
"r2:lifecycle": "ts-node scripts/configure-r2-lifecycle.ts",
"catalog:embed": "python3 scripts/embed_catalog_skus.py",
"circuit-breaker:eval": "SINGLE_SHOT=true ts-node scripts/circuit-breaker-monitor.ts"
```

### Files to Modify
* [`apps/api/package.json`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/package.json)

### Test Plan
Run `pnpm --filter @roomcommerce/api run r2:lifecycle --help` and verify script execution starts without pnpm script errors.

---

## 2. Patch Plan: `FIX-002` Dynamic CORS Origin Handling

### Objective
Enhance CORS origin matching in [`apps/api/src/main.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/main.ts) to support dynamic preview branch URLs (e.g. `https://preview-*.roomcommerce.internal`).

### Existing Problem & Evidence
Currently, `main.ts` sets static origins:
```typescript
origin: [env.WEB_BASE_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'],
```
If deployed to dynamic preview URLs on Cloudflare or AWS, requests are blocked by CORS.

### Proposed Implementation
Replace static array with a function:
```typescript
origin: (requestOrigin, callback) => {
  if (!requestOrigin || 
      requestOrigin === env.WEB_BASE_URL || 
      requestOrigin.startsWith('http://localhost:') ||
      /\.roomcommerce\.(internal|com)$/.test(requestOrigin)) {
    callback(null, true);
  } else {
    callback(new Error('CORS not allowed by RoomCommerce security policy'));
  }
}
```

### Files to Modify
* [`apps/api/src/main.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/main.ts)

### Regression Risks & Acceptance Criteria
* **Risk:** Inadvertently allowing unauthorized third-party origins. Controlled by strict domain regex.
* **Acceptance:** Pre-flight `OPTIONS` requests from valid preview domains return 204 with `Access-Control-Allow-Origin`.

---

## 3. Patch Plan: `FIX-003` PostgreSQL Pagination Index on Projects

### Objective
Add a database index on `projects.created_at` to guarantee sub-10ms query execution when listing user projects in the studio dashboard.

### Proposed Implementation
In [`apps/api/src/database/schema/projects.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/database/schema/projects.ts):
```typescript
export const projects = pgTable('projects', {
  // existing fields...
}, (table) => ({
  userIdIdx: index('projects_user_id_idx').on(table.userId),
  createdAtIdx: index('projects_created_at_idx').on(table.createdAt),
}));
```

### Files to Modify
* [`apps/api/src/database/schema/projects.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/database/schema/projects.ts)

---

## 4. Patch Plan: `FIX-004` SSE Client Reconnection Backoff

### Objective
Enhance the EventSource hook in [`apps/web/src/app/studio/render/[job_id]/page.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/app/studio/render/[job_id]/page.tsx) with automatic exponential backoff reconnection if the connection drops prematurely.

### Proposed Implementation
Add exponential backoff retry loop (1s, 2s, 4s, 8s) up to 5 attempts before marking the job in an unrecoverable error state.
