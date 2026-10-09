"use client";

import { Ago } from "@/components/monitor/ago";
import type { ReportStory } from "@/lib/reports";
import { reportConfidenceLabel } from "@/lib/report-confidence";

function formatDay(ts: number) {
  if (!ts) return "Unknown date";
  return new Date(ts).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ReportTimeline({ stories }: { stories: ReportStory[] }) {
  const rows = [...stories].sort((a, b) => b.latestAt - a.latestAt);

  if (rows.length === 0) {
    return <p className="text-[13px] text-slate-500">No stories to plot on the timeline.</p>;
  }

  const places = [...new Set(rows.flatMap((story) => story.locations))].slice(0, 12);

  return (
    <div className="report-timeline">
      {places.length ? (
        <p className="mb-4 text-[11px] text-slate-600">
          <span className="font-semibold text-slate-800">Places in this briefing:</span>{" "}
          {places.join(" · ")}
        </p>
      ) : null}
      <ol className="report-timeline-list">
        {rows.map((story) => (
          <li key={story.id} className="report-timeline-item">
            <div className="report-timeline-dot" aria-hidden />
            <div className="min-w-0 flex-1">
              <time className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
                {formatDay(story.latestAt)}
                {story.extractAt ? (
                  <span className="ml-2 font-normal normal-case text-slate-400">
                    extract <Ago ts={story.extractAt} />
                  </span>
                ) : null}
              </time>
              <h2 className="report-heading mt-0.5 text-[16px] font-bold leading-snug">
                {story.title}
              </h2>
              {story.confidence ? (
                <span className="report-confidence-badge">{reportConfidenceLabel(story.confidence)}</span>
              ) : null}
              {story.locations.length ? (
                <p className="mt-1 text-[11px] text-slate-500">{story.locations.join(" · ")}</p>
              ) : null}
              {story.summary ? (
                <p className="mt-1 line-clamp-3 text-[12px] text-slate-600">{story.summary}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
