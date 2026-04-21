#!/usr/bin/env bash
# Kiro `stop` hook — fired when the agent signals the turn is complete.
#
# See on-agent-spawn.sh for the RALPH_* env-var contract. This hook writes a
# per-turn `NN-turn.json` sidecar with a simple "turn ended" marker the loop
# runner can watch for. Kiro versions vary in what they pipe on stdin for this
# hook; we intentionally do not parse it — the env vars are enough.

set -euo pipefail

RUN_DIR="${RALPH_RUN_DIR:-}"
ITERATION="${RALPH_ITERATION:-0}"

if [[ -z "${RUN_DIR}" ]]; then
  exit 0
fi

mkdir -p "${RUN_DIR}/iterations"

ITER_PADDED="$(printf '%02d' "${ITERATION}")"
MARKER="${RUN_DIR}/iterations/${ITER_PADDED}-turn.json"

cat > "${MARKER}" <<JSON
{
  "iteration": ${ITERATION},
  "completedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "scout": "${RALPH_SCOUT_NAME:-}"
}
JSON
