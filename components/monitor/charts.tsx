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

export function MiniSpark({
  points,
  color = "#f97316",
}: {
  points: number[];
  color?: string;
}) {
  const max = Math.max(...points, 1);
  const w = 72;
  const h = 18;
  if (points.length < 2) return <span className="inline-block h-[18px] w-[72px]" />;
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - (p / max) * (h - 3) - 1.5;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <path d={d} fill="none" stroke={color} strokeWidth="1.4" />
    </svg>
  );
}

const TREND_STYLE: Record<string, { mark: string; color: string; bg: string }> = {
  up: { mark: "▲", color: "#15803d", bg: "#dcfce7" },
  down: { mark: "▼", color: "#b91c1c", bg: "#fee2e2" },
  new: { mark: "●", color: "#c2410c", bg: "#ffedd5" },
  flat: { mark: "–", color: "#475569", bg: "#f1f5f9" },
};

export function TrendList({
  title,
  hint,
  rows,
  onSelect,
  onShowOnBoard,
  boardCount,
}: {
  title: string;
  hint?: string;
  rows: {
    id: string;
    kind: string;
    label: string;
    now: number;
    prev: number;
    change: number;
    direction: string;
    points: number[];
    sample: string;
    sourcesNow: number;
  }[];
  onSelect: (row: { id: string; kind: string; label: string }) => void;
  onShowOnBoard?: (row: { id: string; kind: string; label: string }) => void;
  boardCount?: (row: { id: string; kind: string }) => number;
}) {
  return (
    <div className="card-tile">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">{title}</div>
        {hint ? <div className="text-[10px] text-slate-400">{hint}</div> : null}
      </div>
      {rows.length === 0 ? (
        <p className="mt-2 text-[12px] text-slate-400">Nothing moving in this window.</p>
      ) : (
        <div className="mt-1.5 space-y-0.5">
          {rows.map((row) => {
            const style = TREND_STYLE[row.direction] ?? TREND_STYLE.flat;
            const delta =
              row.direction === "new"
                ? "new"
                : `${row.change >= 0 ? "+" : ""}${Math.round(row.change * 100)}%`;
            const n = boardCount?.(row);
            return (
              <div
                key={`${row.kind}:${row.id}`}
                className="flex w-full items-center gap-2 rounded px-0.5 py-1 hover:bg-slate-50"
              >
                <button
                  type="button"
                  onClick={() => onSelect(row)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <MiniSpark points={row.points} color={style.color} />
                  <span
                    className="tag shrink-0"
                    style={{ background: style.bg, color: style.color }}
                  >
                    {style.mark} {row.label}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[10px] text-slate-400">{row.sample}</span>
                  <span className="shrink-0 text-[10px] tabular-nums text-slate-500">
                    {row.prev}→{row.now} {delta}
                  </span>
                </button>
                {onShowOnBoard && n != null && n > 0 ? (
                  <button
                    type="button"
                    className="shrink-0 rounded border border-slate-200 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 hover:bg-white"
                    onClick={() => onShowOnBoard(row)}
                  >
                    Brief · {n}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
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
