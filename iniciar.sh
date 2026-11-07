#!/usr/bin/env bash
# Levanta Scordatura en modo desarrollo y la abre en el navegador. Se apaga con Ctrl+C.
set -euo pipefail

cd "$(dirname "$0")"
[ -d node_modules ] || npm install
exec npm run dev -- --open
