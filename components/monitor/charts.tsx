"use client";

export function Sparkline({
  points,
  color = "#f97316",
}: {
  points: number[];
  color?: string;
}) {
  const max = Math.max(...points, 1);
  const w = 220;
  const h = 42;
  if (points.length < 2) {
    return <div className="h-[42px] text-[11px] text-slate-400">Not enough data</div>;
  }
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - (p / max) * (h - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" />
    </svg>
  );
}

export function TopicMix({
  rows,
  onSelect,
}: {
  rows: { id: string; label: string; value: number; color: string }[];
  onSelect: (id: string) => void;
}) {
  const total = rows.reduce((sum, row) => sum + row.value, 0) || 1;
  return (
    <div className="card-tile">
      <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
        Topic mix
      </div>
      <div className="mt-2 flex h-2 overflow-hidden rounded-full">
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            title={`${row.label} ${row.value}`}
            onClick={() => onSelect(row.id)}
            className="h-full"
            style={{ width: `${(row.value / total) * 100}%`, background: row.color }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {rows.slice(0, 8).map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => onSelect(row.id)}
            className="text-[10px] text-slate-500"
          >
            <span className="mr-1 inline-block size-1.5 rounded-full" style={{ background: row.color }} />
            {row.label} {row.value}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PulseCard({
  title,
  points,
}: {
  title: string;
  points: number[];
}) {
  const peak = Math.max(...points, 0);
  return (
    <div className="card-tile">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
          {title}
        </div>
        <div className="text-[10px] text-slate-400">peak {peak}</div>
      </div>
      <Sparkline points={points} />
    </div>
  );
}
