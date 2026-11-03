#!/bin/sh
# Run once: after every pull / checkout / merge / rebase, viewer/index.html is rebuilt automatically.
cd "$(dirname "$0")/.." || exit 1
git config core.hooksPath .githooks
echo "已启用自动生成（git config core.hooksPath .githooks）"
sh scripts/build.sh
