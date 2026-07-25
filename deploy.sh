#!/bin/bash
set -euo pipefail

# ─── Automated Deployment Script ─────────────────────────────────────────
# Full CI/CD pipeline: builds → pushes → deploys automatically.
# Running `deploy.sh` on the EC2 setup.sh triggers Terraform to
# recreate the instance with the new user_data (which runs setup.sh
# and pulls the latest Docker image). Watchtower handles future deploys.
#
# Usage: ./deploy.sh [version]
#   version  optional version tag (default: 1.0.1)

VERSION="${1:-1.0.1}"
IMAGE="sukeshanii/micros"
REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=============================================="
echo "  Micros - Automated Deployment Pipeline"
echo "  Version: $VERSION"
echo "=============================================="

# ── Step 1: Build frontend ────────────────────────────────────────────────
echo ""
echo "==> Step 1/5: Building application..."
cd "$REPO_ROOT/astronautical-altitude"
npm run build

# ── Step 2: Build Docker image ────────────────────────────────────────────
echo ""
echo "==> Step 2/5: Building Docker image..."
docker build -t "$IMAGE:$VERSION" -t "$IMAGE:latest" .

# ── Step 3: Push to Docker Hub ────────────────────────────────────────────
echo ""
echo "==> Step 3/5: Pushing to Docker Hub..."
docker push "$IMAGE:$VERSION"
docker push "$IMAGE:latest"

# ── Step 4: Apply Terraform (updates security group + instance) ───────────
echo ""
echo "==> Step 4/5: Applying Terraform..."
echo "  If setup.sh changed, the EC2 instance will be recreated"
echo "  with the new user_data. MySQL data is persisted on EBS."
cd "$REPO_ROOT/Terraform"
terraform apply -auto-approve

# ── Step 5: Verification ──────────────────────────────────────────────────
echo ""
echo "==> Step 5/5: Verifying deployment..."
echo "  Waiting for instance to be ready..."
sleep 30

EC2_IP="98.94.6.10"
# Try to get the new IP from Terraform output
if command -v terraform &>/dev/null; then
  NEW_IP=$(terraform output -raw instance_public_ip 2>/dev/null || echo "")
  if [ -n "$NEW_IP" ]; then
    EC2_IP="$NEW_IP"
  fi
fi

echo "  Checking http://$EC2_IP ..."
for attempt in 1 2 3 4 5; do
  if curl -sf -o /dev/null -w "%{http_code}" --connect-timeout 10 "http://$EC2_IP" 2>/dev/null; then
    echo "  HTTP status: OK (attempt $attempt)"
    echo ""
    echo "  === Deployment verified successfully! ==="
    break
  else
    echo "  Waiting... (attempt $attempt/5)"
    sleep 10
  fi
done

echo ""
echo "=============================================="
echo "  Deployment complete!"
echo "  Version: $VERSION"
echo "  Image:   $IMAGE:$VERSION (also latest)"
echo "  EC2 IP: $EC2_IP"
echo "  URL:    https://microcalorietracker.online"
echo ""
echo "  Next deploy: just run ./deploy.sh again"
echo "  Or push to Docker Hub → Watchtower"
echo "  auto-deploys in <60s"
echo "=============================================="
