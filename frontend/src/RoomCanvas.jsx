import { Stage, Layer, Rect, Text, Group } from "react-konva";
import { dims, badIds, snapPosition } from "./geometry";
const COLOR = { pillar: "#39403c", door: "rgba(213, 112, 96, 0.2)", counter: "#a8afa9", window: "#6ba5bd" };
export default function RoomCanvas({ room, furniture, layout, onMove, onRotate, maxPx = 520, editable = true }) {
  const S = maxPx / Math.max(room.width, room.depth);
  const bad = badIds(room, furniture, layout);
  return (
    <Stage width={room.width * S + 20} height={room.depth * S + 20}>
      <Layer x={10} y={10}>
        <Rect width={room.width * S} height={room.depth * S} fill="#fbfaf5" stroke="#778278" strokeWidth={2} />
        {room.obstacles.map((o, i) => (
          <Rect key={i} x={o.x * S - (o.w ? 0 : 2)} y={o.y * S - (o.d ? 0 : 2)}
            width={Math.max(o.w * S, 4)} height={Math.max(o.d * S, 4)} fill={COLOR[o.type]} />
        ))}
        {furniture.map(f => {
          const p = layout[f.id]; if (!p) return null;
          const [w, d] = dims(f, p.rotation);
          return (
            <Group key={f.id} x={p.x * S} y={p.y * S} draggable={editable}
              dragBoundFunc={pos => {
                const snapped = snapPosition(room, furniture, layout, f.id, (pos.x - 10) / S, (pos.y - 10) / S);
                return { x: snapped.x * S + 10, y: snapped.y * S + 10 };
              }}
              onDragEnd={e => {
                const x = e.target.x() / S, y = e.target.y() / S;
                const snapped = snapPosition(room, furniture, layout, f.id, x, y);
                onMove?.(f.id,
                  snapped.x === x ? Math.round(x / 10) * 10 : snapped.x,
                  snapped.y === y ? Math.round(y / 10) * 10 : snapped.y);
              }}
              onDblClick={() => onRotate?.(f.id)}>
              <Rect width={w * S} height={d * S} fill="#e7d5b8" opacity={0.96}
                stroke={bad.has(f.id) ? "#d84e45" : "#a88a63"} strokeWidth={bad.has(f.id) ? 3 : 1} />
              <Text text={f.label} fontSize={11} padding={3} width={w * S} fill="#393b36" />
            </Group>
          );
        })}
      </Layer>
    </Stage>
  );
}
