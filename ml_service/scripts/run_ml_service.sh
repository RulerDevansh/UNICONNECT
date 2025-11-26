#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
VENV_DIR="${SERVICE_DIR}/.venv"
UVICORN_BIN="${VENV_DIR}/bin/uvicorn"

if [[ ! -x "${UVICORN_BIN}" ]]; then
  echo "[ml_service] Missing uvicorn at ${UVICORN_BIN}. Run scripts/setup_ml_env.sh first." >&2
  exit 1
fi

HOST="${ML_SERVICE_HOST:-0.0.0.0}"
PORT="${ML_SERVICE_PORT:-8001}"

cd "${SERVICE_DIR}"
exec "${UVICORN_BIN}" src.app.main:app --host "${HOST}" --port "${PORT}" "$@"
