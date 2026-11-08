"""Baroque landmark access for Python, using the same JS kernel as the viewer.

Only this new style requires Node.js. Existing Python house generation is unchanged.
"""
import json
import os
from pathlib import Path
import shutil
import subprocess

from .structure import Structure


def _run(spec, *, output=None, model=False):
    node = os.environ.get("MCGEN_NODE") or shutil.which("node")
    if not node:
        raise RuntimeError("巴洛克生成需要 Node.js；请安装 Node.js，或设置 MCGEN_NODE 为 node 可执行文件路径。其他 Python 民居风格不受影响。")
    root = Path(__file__).resolve().parent.parent
    engine = root / "web" / "mcgen.js"
    if not engine.is_file():
        raise RuntimeError("缺少 web/mcgen.js，请先运行 python web/build_js.py。")
    cmd = [node, str(root / "web" / "baroque_cli.cjs")]
    if output is not None:
        cmd += ["--output", str(Path(output).resolve())]
    if model:
        cmd += ["--model"]
    request = {**spec, "type": "cathedral", "style": "baroque"}
    result = subprocess.run(cmd, input=json.dumps(request, ensure_ascii=False), capture_output=True,
                            text=True, encoding="utf-8", timeout=120, check=False)
    if result.returncode:
        raise RuntimeError("巴洛克生成失败：" + result.stderr.strip())
    return json.loads(result.stdout)


def generate_baroque(spec, out):
    """Return the same (effective_spec, report, W/H/L/block-count) CLI contract."""
    result = _run(spec, output=out)
    return result["spec"], result["report"], tuple(result["size"])


def build_baroque(spec=None):
    """Return a normal Python Structure, with spec/report/placement metadata."""
    result = _run(spec or {}, model=True)
    structure = Structure()
    structure.blocks = {(x, y, z): state for x, y, z, state in result["blocks"]}
    structure.spec = result["spec"]
    structure.report = result["report"]
    structure.placement = result["placement"]
    return structure
