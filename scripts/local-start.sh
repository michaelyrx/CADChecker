#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ ! -f "$repo_root/frontend/.next/BUILD_ID" || ! -x "$repo_root/backend/.venv/bin/python" ]]; then
  printf 'Run ./scripts/local-setup.sh first.\n' >&2
  exit 1
fi
cadlint_data_dir="${CADLINT_DATA_DIR:-$repo_root/.local-verification/data}"
cadlint_python="${CADLINT_PYTHON:-$repo_root/backend/.venv/bin/python}"
cadlint_port="${CADLINT_PORT:-3100}"
mkdir -p "$cadlint_data_dir"
cd "$repo_root/frontend"
printf 'CADLint: http://127.0.0.1:%s\nData: %s\nStop with Ctrl+C.\n' "$cadlint_port" "$cadlint_data_dir"
CADLINT_DATA_DIR="$cadlint_data_dir" CADLINT_PYTHON="$cadlint_python" exec npm run start -- --hostname 127.0.0.1 --port "$cadlint_port"
