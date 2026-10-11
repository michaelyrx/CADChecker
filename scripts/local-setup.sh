#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
npm --prefix frontend ci
backend/.venv/bin/python -m unittest discover backend -p 'test_*.py'
npm --prefix frontend run typecheck
npm --prefix frontend run build
node scripts/make-samples.mjs
node scripts/smoke-local.mjs
node scripts/smoke-bedrock.mjs
printf '\nLocal verification is ready. Run: ./scripts/local-start.sh\n'
