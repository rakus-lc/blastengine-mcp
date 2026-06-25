#!/usr/bin/env bash
set -euo pipefail

out_file="$(mktemp)"
err_file="$(mktemp)"
trap 'rm -f "$out_file" "$err_file"' EXIT

BLASTENGINE_BEARER_TOKEN=test-token BLASTENGINE_LOG_LEVEL=silent node dist/index.js >"$out_file" 2>"$err_file" <<'JSONRPC'
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"blastengine-mcp-test","version":"0.0.0"}}}
{"jsonrpc":"2.0","method":"notifications/initialized"}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
JSONRPC

if [[ -s "$err_file" ]]; then
  echo "Expected no stderr output with BLASTENGINE_LOG_LEVEL=silent" >&2
  cat "$err_file" >&2
  exit 1
fi

node tests/verify-stdio-output.mjs "$out_file"

