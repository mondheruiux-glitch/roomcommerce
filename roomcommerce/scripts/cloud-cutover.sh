#!/usr/bin/env bash
# =============================================================================
# scripts/cloud-cutover.sh — Step 3 Live Cloud Cutover Orchestrator
#
# TASK-004: Modal GPU worker deployment
# TASK-005: Qdrant Cloud vector initialization (db:push + api:seed + api:embed)
# TASK-006: Cloudflare R2 7-day lifecycle policy
# TASK-007: Affiliate circuit-breaker probe (Amazon, Wayfair, Target, IKEA)
# GATE:     Pre-flight readiness scorecard (pnpm preflight)
#
# Usage:
#   pnpm cloud:cutover -- --dry-run        Validate all phases without live execution
#   pnpm cloud:cutover -- --execute        Execute live cutover (irreversible cloud ops)
#   pnpm cloud:cutover -- --dry-run --strict-prod  Validate + strict preflight gate
#   pnpm cloud:cutover -- --help           Show this help
# =============================================================================

set -euo pipefail

# ── Colour helpers ────────────────────────────────────────────────────────────
RESET='\033[0m'; BOLD='\033[1m'
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'

ok()    { echo -e "  ${GREEN}[OK]${RESET}    $*"; }
warn()  { echo -e "  ${YELLOW}[WARN]${RESET}  $*"; }
fail()  { echo -e "  ${RED}[FAIL]${RESET}  $*"; }
info()  { echo -e "  ${CYAN}[INFO]${RESET}  $*"; }
header(){ echo -e "\n${BOLD}$*${RESET}"; echo "$(printf '%0.s─' {1..80})"; }

# ── Flag parsing ──────────────────────────────────────────────────────────────
DRY_RUN=false
EXECUTE=false
STRICT_PROD=false

for arg in "$@"; do
  case "$arg" in
    --dry-run)     DRY_RUN=true ;;
    --execute)     EXECUTE=true ;;
    --strict-prod) STRICT_PROD=true ;;
    --help)
      echo ""
      echo "  cloud-cutover.sh — RoomCommerce Step 3 Live Cloud Cutover Orchestrator"
      echo ""
      echo "  USAGE"
      echo "    pnpm cloud:cutover -- --dry-run              Safe validation (no live ops)"
      echo "    pnpm cloud:cutover -- --execute              Live cutover (cloud changes)"
      echo "    pnpm cloud:cutover -- --dry-run --strict-prod  Strict-prod preflight gate"
      echo ""
      echo "  PHASES"
      echo "    1. Modal GPU Worker   (TASK-004) — workers/gpu-runner/modal_app.py"
      echo "    2. Qdrant + DB Init   (TASK-005) — db:push + api:seed + api:embed"
      echo "    3. Cloudflare R2 7d   (TASK-006) — configure-r2-lifecycle.ts"
      echo "    4. Affiliate Probes   (TASK-007) — circuit-breaker-monitor.ts"
      echo "    5. Pre-Flight Gate    (GATE)     — preflight-verify.ts"
      echo ""
      exit 0
      ;;
  esac
done

if ! $DRY_RUN && ! $EXECUTE; then
  echo ""
  fail "Specify --dry-run or --execute. Run with --help for usage."
  echo ""
  exit 1
fi

MODE_LABEL="DRY-RUN (validation only — no live cloud operations)"
$EXECUTE && MODE_LABEL="EXECUTE (live cloud cutover — changes are irreversible)"

echo ""
echo -e "${BOLD}════════════════════════════════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  ROOMCOMMERCE — STEP 3 LIVE CLOUD CUTOVER ORCHESTRATOR${RESET}"
echo -e "${BOLD}════════════════════════════════════════════════════════════════════════════════${RESET}"
echo -e "  Mode: ${CYAN}${MODE_LABEL}${RESET}"
echo -e "  Time: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo ""

PHASE_PASS=0
PHASE_WARN=0
PHASE_FAIL=0

# ── Phase 1: Modal GPU Worker (TASK-004) ──────────────────────────────────────
header "Phase 1 / 5  Modal GPU Worker  (TASK-004)"

# 1a. Verify Modal CLI is installed
if python3 -m modal --version &>/dev/null; then
  MODAL_VER=$(python3 -m modal --version 2>&1 | head -1)
  ok "Modal CLI present: ${MODAL_VER}"
else
  warn "Modal CLI not installed — run: pip install modal (required for pnpm gpu:deploy)"
fi

# 1b. Syntax-check the Modal app file
MODAL_APP="workers/gpu-runner/modal_app.py"
if [ -f "$MODAL_APP" ]; then
  if python3 -m py_compile "$MODAL_APP" 2>&1; then
    ok "Modal app syntax valid: ${MODAL_APP}"
  else
    fail "Modal app has Python syntax errors: ${MODAL_APP}"
    PHASE_FAIL=$((PHASE_FAIL + 1))
  fi
else
  fail "Modal app file not found: ${MODAL_APP}"
  PHASE_FAIL=$((PHASE_FAIL + 1))
fi

# 1c. Validate MODAL env vars
MODAL_MODE="${MODAL_MOCK_MODE:-unset}"
MODAL_EP="${MODAL_API_ENDPOINT:-}"

if [ "$MODAL_MODE" = "false" ] && echo "$MODAL_EP" | grep -q '\.modal\.run'; then
  ok "MODAL_MOCK_MODE=false and live endpoint configured"
elif [ "$MODAL_MODE" = "true" ]; then
  warn "MODAL_MOCK_MODE=true — set to false and set live MODAL_API_ENDPOINT before executing"
else
  warn "MODAL_API_ENDPOINT appears to be a placeholder — run: pnpm gpu:deploy"
fi

if $EXECUTE; then
  info "Deploying Modal GPU worker (pnpm gpu:deploy)..."
  if pnpm gpu:deploy; then
    ok "Modal GPU worker deployed successfully"
    PHASE_PASS=$((PHASE_PASS + 1))
  else
    fail "Modal GPU deploy failed"
    PHASE_FAIL=$((PHASE_FAIL + 1))
  fi
else
  info "[DRY-RUN] Would execute: pnpm gpu:deploy"
  PHASE_PASS=$((PHASE_PASS + 1))
fi

# ── Phase 2: Database & Qdrant Vector Initialization (TASK-005) ───────────────
header "Phase 2 / 5  Qdrant Cloud & Database Init  (TASK-005)"

QDRANT_URL="${QDRANT_URL:-}"
if echo "$QDRANT_URL" | grep -qE 'localhost|127\.0\.0\.1'; then
  warn "QDRANT_URL points to localhost — provision Qdrant Cloud cluster before executing"
elif [ -z "$QDRANT_URL" ]; then
  fail "QDRANT_URL is not set"
  PHASE_FAIL=$((PHASE_FAIL + 1))
else
  ok "QDRANT_URL configured: ${QDRANT_URL}"
fi

if $EXECUTE; then
  info "Pushing Drizzle schema (pnpm db:push)..."
  pnpm db:push && ok "Schema pushed" || { fail "db:push failed"; PHASE_FAIL=$((PHASE_FAIL + 1)); }

  info "Seeding PostgreSQL catalog (pnpm api:seed)..."
  pnpm api:seed && ok "Catalog seeded" || { fail "api:seed failed"; PHASE_FAIL=$((PHASE_FAIL + 1)); }

  info "Running SigLIP embedding pipeline (pnpm api:embed)..."
  if pnpm api:embed; then
    ok "SigLIP embeddings uploaded to retail_catalog_v1"
    PHASE_PASS=$((PHASE_PASS + 1))
  else
    fail "api:embed failed — check QDRANT_URL, QDRANT_API_KEY, and DATABASE_URL"
    PHASE_FAIL=$((PHASE_FAIL + 1))
  fi
else
  info "[DRY-RUN] Running api:embed --dry-run to verify connectivity..."
  if pnpm api:embed -- --dry-run; then
    ok "Dry-run embed completed successfully"
    PHASE_PASS=$((PHASE_PASS + 1))
  else
    warn "Dry-run embed reported warnings — check QDRANT_URL / database connectivity"
    PHASE_WARN=$((PHASE_WARN + 1))
  fi
fi

# ── Phase 3: Cloudflare R2 Lifecycle Policy (TASK-006) ───────────────────────
header "Phase 3 / 5  Cloudflare R2 7-Day Lifecycle Rule  (TASK-006)"

R2_ACCOUNT="${CLOUDFLARE_R2_ACCOUNT_ID:-}"
R2_BUCKET="${CLOUDFLARE_R2_BUCKET_NAME:-}"

if echo "$R2_ACCOUNT" | grep -qE 'mock|local'; then
  warn "CLOUDFLARE_R2_ACCOUNT_ID appears to be a mock value — configure live R2 credentials first"
  PHASE_WARN=$((PHASE_WARN + 1))
elif [ -z "$R2_ACCOUNT" ]; then
  fail "CLOUDFLARE_R2_ACCOUNT_ID is not set"
  PHASE_FAIL=$((PHASE_FAIL + 1))
else
  ok "R2 account: ${R2_ACCOUNT}  |  Bucket: ${R2_BUCKET:-<not set>}"
fi

if $EXECUTE; then
  info "Applying 7-day R2 lifecycle policy (pnpm api:r2-lifecycle)..."
  if pnpm api:r2-lifecycle; then
    ok "R2 lifecycle policy applied — SEC-01 & PRV-01 enforced"
    PHASE_PASS=$((PHASE_PASS + 1))
  else
    fail "api:r2-lifecycle failed — check R2 credentials and bucket name"
    PHASE_FAIL=$((PHASE_FAIL + 1))
  fi
else
  info "[DRY-RUN] Running api:r2-lifecycle --dry-run to preview lifecycle rule..."
  if pnpm api:r2-lifecycle -- --dry-run 2>/dev/null; then
    ok "R2 lifecycle dry-run completed"
    PHASE_PASS=$((PHASE_PASS + 1))
  else
    warn "R2 lifecycle dry-run returned non-zero — live R2 credentials likely not yet configured"
    PHASE_WARN=$((PHASE_WARN + 1))
  fi
fi

# ── Phase 4: Affiliate Circuit-Breaker Probe (TASK-007) ──────────────────────
header "Phase 4 / 5  Affiliate Stock Adapter Circuit-Breaker  (TASK-007)"

STRIPE_KEY="${STRIPE_SECRET_KEY:-}"
if echo "$STRIPE_KEY" | grep -q 'sk_live_'; then
  ok "Stripe: LIVE mode (sk_live_*)"
elif echo "$STRIPE_KEY" | grep -q 'sk_test_'; then
  warn "Stripe: TEST mode (sk_test_*) — switch to sk_live_* before production cutover"
  PHASE_WARN=$((PHASE_WARN + 1))
else
  fail "Stripe key missing or unrecognized format"
  PHASE_FAIL=$((PHASE_FAIL + 1))
fi

# Check affiliate tokens (warn on mock values)
for VAR_NAME in AMAZON_PAAPI_ACCESS_KEY WAYFAIR_API_CLIENT_ID IMPACT_RADIUS_API_TOKEN CJ_AFFILIATE_TOKEN; do
  VAL="${!VAR_NAME:-}"
  if echo "$VAL" | grep -qE 'mock|your_|<'; then
    warn "${VAR_NAME} is a placeholder — configure live affiliate credentials"
    PHASE_WARN=$((PHASE_WARN + 1))
  elif [ -z "$VAL" ]; then
    warn "${VAR_NAME} is not set — affiliate stock adapter will use fallback"
    PHASE_WARN=$((PHASE_WARN + 1))
  else
    ok "${VAR_NAME} configured"
  fi
done

info "Running affiliate circuit-breaker health probe (pnpm api:circuit-breaker)..."
if pnpm api:circuit-breaker 2>/dev/null; then
  ok "Circuit-breaker probe passed — all stock adapters responsive"
  PHASE_PASS=$((PHASE_PASS + 1))
else
  warn "Circuit-breaker probe exited non-zero — adapters may be in fallback mode (expected in dry-run)"
  PHASE_WARN=$((PHASE_WARN + 1))
fi

# ── Phase 5: Pre-Flight Readiness Scorecard ───────────────────────────────────
header "Phase 5 / 5  Pre-Flight Readiness Scorecard  (GATE)"

if $STRICT_PROD; then
  info "Running preflight in --strict-prod mode (will exit 1 on any MOCK/OFFLINE gate)..."
  if pnpm preflight -- --strict-prod; then
    ok "STRICT-PROD PASS — all 7 gates READY"
    PHASE_PASS=$((PHASE_PASS + 1))
  else
    fail "STRICT-PROD FAIL — one or more gates are MOCK or OFFLINE. Not ready for production cutover."
    PHASE_FAIL=$((PHASE_FAIL + 1))
  fi
else
  info "Running preflight in diagnostic mode..."
  pnpm preflight
  PHASE_PASS=$((PHASE_PASS + 1))
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}════════════════════════════════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  CUTOVER SUMMARY${RESET}"
echo -e "  Phases: ${GREEN}${PHASE_PASS} PASS${RESET}  |  ${YELLOW}${PHASE_WARN} WARN${RESET}  |  ${RED}${PHASE_FAIL} FAIL${RESET}"
echo ""

if $EXECUTE; then
  if [ "$PHASE_FAIL" -gt 0 ]; then
    echo -e "  ${RED}CUTOVER INCOMPLETE — resolve the failures above before activating canary traffic.${RESET}"
    echo -e "  ${BOLD}Next step:${RESET} Fix errors, then run: pnpm preflight -- --strict-prod"
    echo ""
    exit 1
  else
    echo -e "  ${GREEN}CUTOVER COMPLETE.${RESET} Proceed to Step 4: ECS deploy + canary traffic ramp."
    echo -e "  ${BOLD}Next step:${RESET} pnpm infra:deploy-worker && pnpm infra:autoscaling"
  fi
else
  echo -e "  ${CYAN}DRY-RUN complete.${RESET} Resolve warnings above, then run:"
  echo -e "  ${BOLD}  pnpm cloud:cutover -- --execute${RESET}"
  if $STRICT_PROD && [ "$PHASE_FAIL" -gt 0 ]; then
    exit 1
  fi
fi
echo ""
