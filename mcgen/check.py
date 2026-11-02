"""Leak check: flood the outside air from beyond the bounding box; any room cell it reaches is
exposed through a hole. Every block (stairs, slabs, glass, doors) counts as closed, so this finds
real gaps only. Returns the exposed room cells."""
from collections import deque


def leaks(S, rooms):
    """rooms: list of (x0, x1, z0, z1, y0, y1) boxes (exclusive x/z bounds, inclusive y)."""
    blocks = S.blocks
    xs = [k[0] for k in blocks]; ys = [k[1] for k in blocks]; zs = [k[2] for k in blocks]
    X0, X1, Y0, Y1, Z0, Z1 = min(xs) - 1, max(xs) + 1, min(ys) - 1, max(ys) + 1, min(zs) - 1, max(zs) + 1
    room = lambda x, y, z: any(x0 < x < x1 and z0 < z < z1 and y0 <= y <= y1 for x0, x1, z0, z1, y0, y1 in rooms)
    start = (X0, Y1, Z0)
    seen = {start}
    q = deque([start])
    hit = set()
    while q:
        x, y, z = q.popleft()
        for dx, dy, dz in ((1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)):
            n = (x + dx, y + dy, z + dz)
            if n in seen or n in blocks or not (X0 <= n[0] <= X1 and Y0 <= n[1] <= Y1 and Z0 <= n[2] <= Z1):
                continue
            seen.add(n)
            if room(*n):
                hit.add(n)
                continue          # don't spread through the room, just report the entry cell
            q.append(n)
    return hit
