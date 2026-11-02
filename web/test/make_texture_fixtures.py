"""Generate tiny, original PNG/ZIP fixtures for texture-browser.cjs."""
import json
import struct
import zlib
from pathlib import Path
from zipfile import ZipFile, ZIP_STORED, ZIP_DEFLATED

root = Path(__file__).resolve().parents[2] / 'out' / 'texture-tests'
root.mkdir(parents=True, exist_ok=True)

def chunk(kind, data):
    return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))

png = (b'\x89PNG\r\n\x1a\n'
       + chunk(b'IHDR', struct.pack('>IIBBBBB', 16, 16, 8, 6, 0, 0, 0))
       + chunk(b'IDAT', zlib.compress((b'\0' + bytes([180, 50, 128, 255]) * 16) * 16))
       + chunk(b'IEND', b''))
for name, prefix, method in [
    ('stored.zip', 'wrapper/assets/minecraft/textures/block/', ZIP_STORED),
    ('game.jar', 'assets/minecraft/textures/block/', ZIP_DEFLATED),
    ('legacy.zip', 'textures/blocks/', ZIP_DEFLATED),
    ('nested.zip', 'block/custom/', ZIP_DEFLATED),
    ('flat.zip', '', ZIP_DEFLATED),
]:
    with ZipFile(root / name, 'w', compression=method) as archive:
        archive.writestr(prefix + 'stone.png', png)
        archive.writestr('assets/minecraft/models/block/stone.json', json.dumps({
            'parent': 'minecraft:block/cube_all', 'textures': {'all': 'minecraft:block/stone'}}))
    print(root / name)
