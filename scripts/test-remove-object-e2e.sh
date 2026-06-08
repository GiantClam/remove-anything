#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
PAGE_URL="${REMOVE_OBJECT_E2E_URL:-http://127.0.0.1:3001/zh-tw/remove-objects}"
SOURCE_IMAGE="${REMOVE_OBJECT_E2E_IMAGE:-/Users/beihuang/Downloads/QQ842850240_Comp__00001_etsds_1780633248.png}"
TEST_FILE="$ROOT_DIR/tests/remove-objects/remove-object.e2e.cli.js"
export PLAYWRIGHT_CLI_SESSION="ro-$RANDOM-$RANDOM"
RUN_DIR="$ROOT_DIR/output/playwright/remove-object/$PLAYWRIGHT_CLI_SESSION"
DOWNLOAD_DIR="${REMOVE_OBJECT_E2E_DOWNLOAD_DIR:-$RUN_DIR/downloads}"
SCREENSHOT_DIR="${REMOVE_OBJECT_E2E_SCREENSHOT_DIR:-$RUN_DIR/screenshots}"

mkdir -p "$ROOT_DIR/output/playwright/remove-object"
mkdir -p "$DOWNLOAD_DIR" "$SCREENSHOT_DIR"

cleanup() {
  bash "$PWCLI" close >/dev/null 2>&1 || true
}
trap cleanup EXIT

cd "$ROOT_DIR/output/playwright/remove-object"

echo "Session: $PLAYWRIGHT_CLI_SESSION"
echo "Page URL: $PAGE_URL"
echo "Source Image: $SOURCE_IMAGE"
echo "Download Dir: $DOWNLOAD_DIR"

OPEN_URL="about:blank" bash "$PWCLI" open about:blank >/dev/null
TMP_OUTPUT="$(mktemp)"
RENDERED_TEST="$(mktemp -t remove-object-e2e)"
PAGE_URL="$PAGE_URL" \
SOURCE_IMAGE="$SOURCE_IMAGE" \
DOWNLOAD_DIR="$DOWNLOAD_DIR" \
SCREENSHOT_DIR="$SCREENSHOT_DIR" \
TEMPLATE_PATH="$TEST_FILE" \
RENDERED_PATH="$RENDERED_TEST" \
node <<'NODE'
const fs = require("node:fs");

const replacements = {
  "__PAGE_URL__": process.env.PAGE_URL,
  "__SOURCE_IMAGE__": process.env.SOURCE_IMAGE,
  "__DOWNLOAD_DIR__": process.env.DOWNLOAD_DIR,
  "__SCREENSHOT_DIR__": process.env.SCREENSHOT_DIR,
};

let content = fs.readFileSync(process.env.TEMPLATE_PATH, "utf8");
for (const [key, value] of Object.entries(replacements)) {
  content = content.replaceAll(key, JSON.stringify(value));
}
fs.writeFileSync(process.env.RENDERED_PATH, content);
NODE

bash "$PWCLI" run-code --filename "$RENDERED_TEST" | tee "$TMP_OUTPUT"

OUTPUT_PATH="$(awk -F= '/E2E_OUTPUT_PATH=/{print $2}' "$TMP_OUTPUT" | tail -n 1)"
TASK_ID="$(awk -F= '/E2E_TASK_ID=/{print $2}' "$TMP_OUTPUT" | tail -n 1)"

if [[ ! "${TASK_ID:-}" =~ ^[0-9]+$ ]]; then
  TASK_ID="unknown"
fi

if [[ -z "$OUTPUT_PATH" || ! -s "$OUTPUT_PATH" ]]; then
  if compgen -G "$DOWNLOAD_DIR/*" >/dev/null; then
    OUTPUT_PATH="$(ls -t "$DOWNLOAD_DIR"/* | head -n 1)"
  fi
fi

if [[ -z "$OUTPUT_PATH" || ! -s "$OUTPUT_PATH" ]]; then
  echo "Download verification failed. Output path: ${OUTPUT_PATH:-<missing>}" >&2
  exit 1
fi

echo "Verified download: $OUTPUT_PATH"
echo "Task ID: ${TASK_ID:-unknown}"
