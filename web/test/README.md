# JS ↔ Python 一致性测试

## Texture import regression tests

Requires Node.js, Playwright, Microsoft Edge, and Python for ZIP fixtures.
Run from the project root:

```powershell
python web/test/make_texture_fixtures.py
node web/test/texture-browser.cjs out/texture-tests/stored.zip out/texture-tests/game.jar out/texture-tests/legacy.zip out/texture-tests/nested.zip out/texture-tests/flat.zip
node web/test/texture-browser.cjs "D:/美术参考/assets" "D:/美术参考/Whimscape_26.1-26.3_r2"
```

The browser tests check actual GPU texture layers, decoding failures, WebGL errors,
texture toggling, overlapping pack loads, and IndexedDB restoration. ZIP fixtures
contain a generated solid-color PNG; no game textures are bundled.
The regression was concurrent model indexing clearing decoded images before GPU
upload. Indexing must finish before the first mesh rebuild starts image decoding.

Imports now resolve texture names from the block palette before meshing, so a
pack change builds geometry once. File reads, ZIP decompression and image decoding
run through an eight-worker queue. Replaced ImageBitmaps are explicitly closed,
and persistence connections close when their transactions finish.

The browser test also alternates packs 20 times, checks read/decode concurrency,
and verifies that only the current pack's decoded bitmaps remain open. Set
`TEXTURE_BROWSER=chrome` to use Chrome instead of Edge. For per-sample timing:

```powershell
node web/test/texture-profile.cjs "D:/美术参考/assets" "D:/美术参考/Whimscape_26.1-26.3_r2"
```

### Chrome exits after textures appear

Local Chrome crash metadata on 2026-10-29 identified `ptype=browser` and
`0xe0000008` (out of memory), including a failed allocation of `0xcdec0004`
bytes. The user reported exit after rendering. This points to investigating the
post-render cache write; it does not by itself prove which Chromium function
requested the allocation. The native exit was not reproduced in isolated tests.

The legacy cache stored the entire pack as native File/Blob references in one
IndexedDB record. The replacement `mcgen-textures-v2` cache stores deduplicated
ArrayBuffer records in batches of eight and publishes a plain metadata manifest
only after all writes finish. Saves are serialized and superseded saves cancel.
The old database is left untouched and is no longer read; users must select their
pack once after upgrading. No browser profile or global settings are changed.

The browser regression checks wait for the full pack to finish saving, verify
the record count and byte-based format, and restore the entire pack before the
switching stress test. `chrome-crash-summary.py` reads exception/module metadata
from the four newest local Chrome dumps; it does not upload dumps or print page
memory. Stack module candidates are not a symbolized or unwound call stack.


在项目根目录运行：

```bash
python -X utf8 web/test/make_specs.py   # 生成 292 组参数（全部示例 + 随机组合：户型、屋顶、斜放、功能、配色、混色）
python -X utf8 web/test/py_run.py       # Python 版生成，结果写入 web/test/py.json
node web/test/js_run.js         # JS 版生成并逐格比对方块和报告
```
