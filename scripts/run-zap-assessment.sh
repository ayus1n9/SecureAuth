#!/usr/bin/env bash
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
REPORTS_DIR="$PROJECT_ROOT/reports"

mkdir -p "$REPORTS_DIR"
cd "$PROJECT_ROOT"

echo "=========================================================="
echo "    SecureAuth — Automated OWASP ZAP Assessment Workflow"
echo "=========================================================="

cleanup() {
  echo "[CLEANUP] Stopping background processes..."
  if [ -n "$BASELINE_PID" ] && kill -0 "$BASELINE_PID" 2>/dev/null; then
    kill "$BASELINE_PID" 2>/dev/null || true
  fi
  if [ -n "$HARDENED_PID" ] && kill -0 "$HARDENED_PID" 2>/dev/null; then
    kill "$HARDENED_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

# -----------------------------------------------------------------
# 1. RUN BASELINE ASSESSMENT (Isolated Vulnerable Fixture)
# -----------------------------------------------------------------
echo ""
echo "[PHASE 1] Starting Isolated Vulnerable Baseline Fixture on port 5001..."
NODE_PATH="$PROJECT_ROOT/backend/node_modules" \
  npx --prefix "$PROJECT_ROOT/backend" tsx "$PROJECT_ROOT/security/fixtures/vulnerable-baseline.ts" \
  > "$REPORTS_DIR/baseline-server.log" 2>&1 &
BASELINE_PID=$!

echo "[PHASE 1] Waiting for baseline fixture on http://127.0.0.1:5001/health..."
for i in {1..30}; do
  if curl -s http://127.0.0.1:5001/health >/dev/null 2>&1; then
    echo "[PHASE 1] Vulnerable baseline fixture is healthy."
    break
  fi
  sleep 1
done

echo "[PHASE 1] Executing OWASP ZAP Baseline Scan against baseline fixture (http://127.0.0.1:5001)..."
docker run --rm \
  --network="host" \
  -v "$REPORTS_DIR":/zap/wrk/:rw \
  ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py \
    -t http://127.0.0.1:5001 \
    -J zap-baseline-report.json \
    -r zap-baseline-report.html \
    -I || true

echo "[PHASE 1] Baseline ZAP scan complete. Stopping baseline fixture..."
kill "$BASELINE_PID" 2>/dev/null || true
wait "$BASELINE_PID" 2>/dev/null || true
BASELINE_PID=""

# -----------------------------------------------------------------
# 2. RUN HARDENED ASSESSMENT (Mitigated Application)
# -----------------------------------------------------------------
echo ""
echo "[PHASE 2] Starting Hardened SecureAuth Backend on port 5000..."
(cd "$PROJECT_ROOT/backend" && npm run start) > "$REPORTS_DIR/hardened-server.log" 2>&1 &
HARDENED_PID=$!

echo "[PHASE 2] Waiting for hardened backend on http://127.0.0.1:5000/health..."
for i in {1..30}; do
  if curl -s http://127.0.0.1:5000/health >/dev/null 2>&1; then
    echo "[PHASE 2] Hardened backend is healthy."
    break
  fi
  sleep 1
done

echo "[PHASE 2] Executing OWASP ZAP Baseline Scan against hardened backend (http://127.0.0.1:5000)..."
docker run --rm \
  --network="host" \
  -v "$REPORTS_DIR":/zap/wrk/:rw \
  ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py \
    -t http://127.0.0.1:5000 \
    -J zap-hardened-report.json \
    -r zap-hardened-report.html \
    -I || true

echo "[PHASE 2] Hardened ZAP scan complete. Stopping backend..."
kill "$HARDENED_PID" 2>/dev/null || true
wait "$HARDENED_PID" 2>/dev/null || true
HARDENED_PID=""

echo ""
echo "=========================================================="
echo "    OWASP ZAP Reports Generated Successfully!"
echo "    - reports/zap-baseline-report.json"
echo "    - reports/zap-baseline-report.html"
echo "    - reports/zap-hardened-report.json"
echo "    - reports/zap-hardened-report.html"
echo "=========================================================="
