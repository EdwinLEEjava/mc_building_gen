"""Read only exception/module metadata from recent Chrome minidumps, not page memory."""
import os
import struct
import uuid
from pathlib import Path
from datetime import datetime, timezone

root = Path(os.environ['LOCALAPPDATA']) / 'Google/Chrome/User Data/Crashpad/reports'
for path in sorted(root.glob('*.dmp'), key=lambda p: p.stat().st_mtime, reverse=True)[:4]:
    data = path.read_bytes()
    u32 = lambda p: struct.unpack_from('<I', data, p)[0]
    u64 = lambda p: struct.unpack_from('<Q', data, p)[0]
    def string(p):
        return data[p + 4:p + 4 + u32(p)].decode('utf-16-le', errors='replace')
    def utf8(rva):
        return data[rva+4:rva+4+u32(rva)].decode('utf-8', errors='replace')
    streams = {u32(p): (u32(p + 4), u32(p + 8))
               for p in range(u32(12), u32(12) + 12 * u32(8), 12)}
    modules = []
    if 4 in streams:
        start = streams[4][1]
        for i in range(u32(start)):
            p = start + 4 + i * 108
            modules.append((u64(p), u32(p + 8), string(u32(p + 20)).replace('\\', '/').split('/')[-1]))
            if modules[-1][2] == 'chrome.dll':
                cv = u32(p + 80)
                if data[cv:cv+4] == b'RSDS':
                    print('symbol id:', uuid.UUID(bytes_le=data[cv+4:cv+20]).hex.upper() + str(u32(cv+20)))
    def locate(address):
        return next((f'{name}+0x{address-base:x}' for base, size, name in modules if base <= address < base + size), hex(address))
    print(path.name, datetime.fromtimestamp(u32(20), timezone.utc).isoformat())
    if 0x43500001 in streams:
        p = streams[0x43500001][1]
        dictionaries = [u32(p + 40)]
        module_list = u32(p + 48)
        if module_list:
            for i in range(u32(module_list)):
                info = u32(module_list + 4 + i * 12 + 8)
                dictionaries.append(u32(info + 16))
                objects = u32(info + 24)
                if objects:
                    for j in range(u32(objects)):
                        obj = objects + 4 + j * 12
                        key = utf8(u32(obj))
                        if key in ['ptype', 'oom-size', 'num-extensions', 'shutdown-type']:
                            print(key, utf8(u32(obj + 8)))
        for annotations in dictionaries:
            if not annotations:
                continue
            for i in range(u32(annotations)):
                entry = annotations + 4 + i * 8
                def utf8(rva):
                    return data[rva+4:rva+4+u32(rva)].decode('utf-8', errors='replace')
                key, value = utf8(u32(entry)), utf8(u32(entry + 4))
                if key in ['ptype', 'ver', 'prod', 'channel']:
                    print(key, value)
    if 6 in streams:
        p = streams[6][1]
        code, address, n = u32(p + 8), u64(p + 24), u32(p + 32)
        print('exception', hex(code), 'at', locate(address), 'parameters', [hex(u64(p + 40 + 8*i)) for i in range(min(n, 15))])
        if 3 in streams:
            thread_list = streams[3][1]
            for i in range(u32(thread_list)):
                t = thread_list + 4 + 48*i
                if u32(t) == u32(p):
                    stack_size, stack_rva = u32(t+32), u32(t+36)
                    context = u32(p + 164)
                    rsp = u64(context + 152)
                    delta = max(0, rsp-u64(t+24))
                    stack = [locate(u64(s)) for s in range(stack_rva+delta, stack_rva+min(stack_size, delta+2048), 8)]
                    print('stack module candidates:', list(dict.fromkeys(s for s in stack if '+' in s))[:24])
    print('graphics modules:', [(name, hex(base)) for base, size, name in modules
          if any(token in name.lower() for token in ['nvidia', 'nvwg', 'nvog', 'amd', 'atid', 'igd', 'd3d', 'angle', 'gles', 'vulkan'])])
