#!/bin/sh
# Build everything that is generated (not kept in git): web/mcgen.js, web/mcgen_data.json, viewer/index.html.
cd "$(dirname "$0")/.." || exit 1
for py in python3 python py; do
  if command -v "$py" >/dev/null 2>&1 && "$py" -c "import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)" 2>/dev/null; then
    exec "$py" build_viewer.py
  fi
done
echo "mcgen: 没找到 Python 3，无法生成 viewer/index.html" >&2
exit 1
