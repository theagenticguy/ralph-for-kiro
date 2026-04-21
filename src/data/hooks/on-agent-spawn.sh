#!/usr/bin/env bash
# Kiro `agentSpawn` hook — fired by kiro-cli when the agent starts a new turn.
#
# ralph-for-kiro sets these env vars on the subprocess before invoking kiro-cli
# chat, so hooks always know where to write artifacts without parsing the
# hook's JSON stdin payload:
#
#   RALPH_RUN_DIR       Absolute path to this run's `results/<scout>/pw-*/`
#                       directory. Always exists.
#   RALPH_ITERATION     1-based iteration number for this kiro-cli invocation.
#   RALPH_SCOUT_NAME    Scout name (empty for non-scout watch runs).
#
# The hook writes an iteration-marker JSON so the runner never has to grep
# stdout or re-read Kiro's SQLite DB to know a turn started.

set -euo pipefail

RUN_DIR="${RALPH_RUN_DIR:-}"
ITERATION="${RALPH_ITERATION:-0}"

if [[ -z "${RUN_DIR}" ]]; then
  exit 0
fi

mkdir -p "${RUN_DIR}/iterations"

# Pad to 2 digits so `ls iterations/` sorts chronologically.
ITER_PADDED="$(printf '%02d' "${ITERATION}")"
MARKER="${RUN_DIR}/iterations/${ITER_PADDED}-spawn.json"

cat > "${MARKER}" <<JSON
{
  "iteration": ${ITERATION},
  "spawnedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "scout": "${RALPH_SCOUT_NAME:-}",
  "cwd": "$(pwd)"
}
JSON
