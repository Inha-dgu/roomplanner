const BLOCKING = ["pillar", "door", "counter"];
export const dims = (f, rot) => (rot % 180 === 90 ? [f.d, f.w] : [f.w, f.d]);
const ov = (a, b) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
export function badIds(room, furniture, layout) {
  const bad = new Set(), rs = [];
  for (const f of furniture) {
    const p = layout[f.id]; if (!p) continue;
    const [w, d] = dims(f, p.rotation); const r = [p.x, p.y, w, d];
    if (p.x < 0 || p.y < 0 || p.x + w > room.width || p.y + d > room.depth) bad.add(f.id);
    for (const o of room.obstacles) if (BLOCKING.includes(o.type) && ov(r, [o.x, o.y, o.w, o.d])) bad.add(f.id);
    for (const [id, q] of rs) if (ov(r, q)) { bad.add(f.id); bad.add(id); }
    rs.push([f.id, r]);
  }
  return bad;
}

export function snapPosition(room, furniture, layout, movingId, x, y, threshold = 80) {
  const moving = furniture.find(f => f.id === movingId);
  if (!moving) return { x, y };
  const movingPosition = layout[movingId];
  const [width, depth] = dims(moving, movingPosition?.rotation ?? 0);
  const xTargets = [0, room.width - width];
  const yTargets = [0, room.depth - depth];

  for (const f of furniture) {
    if (f.id === movingId || !layout[f.id]) continue;
    const p = layout[f.id];
    const [otherWidth, otherDepth] = dims(f, p.rotation);
    xTargets.push(
      p.x,
      p.x + otherWidth,
      p.x - width,
      p.x + otherWidth - width,
      p.x + (otherWidth - width) / 2
    );
    yTargets.push(
      p.y,
      p.y + otherDepth,
      p.y - depth,
      p.y + otherDepth - depth,
      p.y + (otherDepth - depth) / 2
    );
  }

  for (const pillar of room.obstacles.filter(o => o.type === "pillar")) {
    xTargets.push(
      pillar.x,
      pillar.x + pillar.w,
      pillar.x - width,
      pillar.x + pillar.w - width,
      pillar.x + (pillar.w - width) / 2
    );
    yTargets.push(
      pillar.y,
      pillar.y + pillar.d,
      pillar.y - depth,
      pillar.y + pillar.d - depth,
      pillar.y + (pillar.d - depth) / 2
    );
  }

  const nearestTarget = (value, targets) => {
    let nearest = value;
    let distance = threshold;
    for (const target of targets) {
      const nextDistance = Math.abs(target - value);
      if (nextDistance < distance) {
        nearest = target;
        distance = nextDistance;
      }
    }
    return nearest;
  };

  return {
    x: nearestTarget(x, xTargets),
    y: nearestTarget(y, yTargets)
  };
}
