#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
test -f .local/runtime.env || { echo 'Run tools/setup.sh first'; exit 1; }
docker compose -p sismoalert-test -f compose.yaml -f deploy/test.yaml up -d --wait
python3 tests/integration.py
