BLOCKING = ("pillar", "door", "counter")
NAMES = {"pillar": "기둥", "door": "문 회전반경", "counter": "붙박이 주방가구"}

def rect(x, y, w, d, rot=0):
    return (x, y, d, w) if rot in (90, 270) else (x, y, w, d)

def overlap(a, b):
    ax, ay, aw, ad = a; bx, by, bw, bd = b
    return ax < bx + bw and bx < ax + aw and ay < by + bd and by < ay + ad

def validate(room, furniture, items):
    errors, fmap, placed = [], {f["id"]: f for f in furniture}, []
    blockers = [o for o in room["obstacles"] if o["type"] in BLOCKING]
    for it in items:
        f = fmap.get(it["id"])
        if not f:
            errors.append(f"알 수 없는 가구 id {it['id']}"); continue
        r = rect(it["x"], it["y"], f["w"], f["d"], it.get("rotation", 0))
        if r[0] < 0 or r[1] < 0 or r[0] + r[2] > room["width"] or r[1] + r[3] > room["depth"]:
            errors.append(f"{f['type']}({it['id']})가 벽 밖으로 나감")
        for o in blockers:
            if overlap(r, (o["x"], o["y"], o["w"], o["d"])):
                errors.append(f"{f['type']}({it['id']})가 {NAMES[o['type']]}(x={o['x']},y={o['y']},w={o['w']},d={o['d']})과 겹침")
        for pid, pr in placed:
            if overlap(r, pr):
                errors.append(f"{it['id']}와 {pid}가 서로 겹침")
        placed.append((it["id"], r))
    missing = set(fmap) - {i["id"] for i in items}
    if missing:
        errors.append(f"배치 누락: {sorted(missing)}")
    return errors
