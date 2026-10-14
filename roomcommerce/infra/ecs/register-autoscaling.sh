#!/usr/bin/env bash
# infra/ecs/register-autoscaling.sh
#
# Registers Application Auto Scaling policies for both ECS services.
# Scale range: 2–20 tasks driven by CPU (>70%) and Memory (>75%) alarms.
# Requirements: NFR-05 (50 concurrent requests auto-scaling)
#
# Usage: AWS_REGION=us-east-1 bash infra/ecs/register-autoscaling.sh [prod|staging]

set -euo pipefail

ENV=${1:-prod}
CLUSTER="roomcommerce-${ENV}"
AWS_REGION=${AWS_REGION:-us-east-1}

for SERVICE in roomcommerce-web roomcommerce-api; do
  FULL_SERVICE="${SERVICE}-${ENV}"
  RESOURCE_ID="service/${CLUSTER}/${FULL_SERVICE}"

  echo "[*] Registering scalable target: ${RESOURCE_ID}"

  # ── Register scalable target ─────────────────────────────────────────────
  aws application-autoscaling register-scalable-target \
    --service-namespace ecs \
    --resource-id "${RESOURCE_ID}" \
    --scalable-dimension ecs:service:DesiredCount \
    --min-capacity 2 \
    --max-capacity 20 \
    --region "${AWS_REGION}"

  # ── Scale-out policy: CPU > 70% ──────────────────────────────────────────
  aws application-autoscaling put-scaling-policy \
    --service-namespace ecs \
    --resource-id "${RESOURCE_ID}" \
    --scalable-dimension ecs:service:DesiredCount \
    --policy-name "${FULL_SERVICE}-scale-out-cpu" \
    --policy-type TargetTrackingScaling \
    --target-tracking-scaling-policy-configuration "{
      \"TargetValue\": 70.0,
      \"PredefinedMetricSpecification\": {
        \"PredefinedMetricType\": \"ECSServiceAverageCPUUtilization\"
      },
      \"ScaleOutCooldown\": 60,
      \"ScaleInCooldown\": 300
    }" \
    --region "${AWS_REGION}"

  echo "[✓] CPU target-tracking policy registered for ${FULL_SERVICE}."

  # ── Scale-out policy: Memory > 75% ───────────────────────────────────────
  aws application-autoscaling put-scaling-policy \
    --service-namespace ecs \
    --resource-id "${RESOURCE_ID}" \
    --scalable-dimension ecs:service:DesiredCount \
    --policy-name "${FULL_SERVICE}-scale-out-mem" \
    --policy-type TargetTrackingScaling \
    --target-tracking-scaling-policy-configuration "{
      \"TargetValue\": 75.0,
      \"PredefinedMetricSpecification\": {
        \"PredefinedMetricType\": \"ECSServiceAverageMemoryUtilization\"
      },
      \"ScaleOutCooldown\": 60,
      \"ScaleInCooldown\": 300
    }" \
    --region "${AWS_REGION}"

  echo "[✓] Memory target-tracking policy registered for ${FULL_SERVICE}."
  echo ""
done

echo "════════════════════════════════════════════════════════"
echo "  Auto-scaling registered for cluster: ${CLUSTER}"
echo "  Services: roomcommerce-web-${ENV}, roomcommerce-api-${ENV}"
echo "  Scale range: 2–20 tasks per service"
echo "  CPU scale-out @ 70% | Memory scale-out @ 75%"
echo "════════════════════════════════════════════════════════"
