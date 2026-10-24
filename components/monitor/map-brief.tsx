"use client";

import type { SituationBrief } from "@/lib/situation-brief";

function sourceLine(names: string[]) {
  if (!names.length) return "";
  const shown = names.slice(0, 3).join(", ");
  const extra = names.length - 3;
  return extra > 0 ? `${shown} +${extra}` : shown;
}

export function MapBrief({
  brief,
  onOpenStory,
  onSelectPlace,
  onOpenWatch,
  onStartReport,
}: {
  brief: SituationBrief;
  onOpenStory?: (storyId: string) => void;
  onSelectPlace?: (name: string) => void;
  onOpenWatch?: (watch: SituationBrief["watches"][number]) => void;
  onStartReport?: () => void;
}) {
  return (
    <div className="map-drawer is-brief" role="region" aria-label="Situation brief">
      <div className="map-drawer-head">
        <span>In this frame</span>
        <span className="text-slate-400">{brief.storyCount}</span>
      </div>
      <div className="map-drawer-body map-drawer-stats">
        {brief.storyCount === 0 ? (
          <p className="map-drawer-empty">Nothing in this frame.</p>
        ) : (
          <>
            <p className="map-brief-line">
              {brief.storyCount} {brief.storyCount === 1 ? "story" : "stories"}
              {" · "}
              {brief.corroborated} with 2+ sources
            </p>
            {brief.rising.length > 0 ? (
              <p className="map-brief-line">Rising: {brief.rising.join(", ")}</p>
            ) : null}
            <div>
              <div className="map-stat-title">Top stories</div>
              {brief.stories.map((story) => (
                <button
                  key={story.id}
                  type="button"
                  className="map-feed-row"
                  onClick={() => onOpenStory?.(story.id)}
                >
                  <span className="map-feed-title">{story.title}</span>
                  <span className="map-feed-meta">
                    {[story.place, story.lane, sourceLine(story.sources)].filter(Boolean).join(" · ")}
                  </span>
                </button>
              ))}
            </div>
            {brief.places.length > 0 ? (
              <div>
                <div className="map-stat-title">Places</div>
                <div className="map-brief-places">
                  {brief.places.map((place) => (
                    <button
                      key={place.name}
                      type="button"
                      className="map-overlay-tab"
                      onClick={() => onSelectPlace?.(place.name)}
                    >
                      {place.name}
                      {place.lane ? ` · ${place.lane}` : ""} {place.count}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {brief.watches.length > 0 ? (
              <div>
                <div className="map-stat-title">Watch</div>
                {brief.watches.map((watch) => (
                  <button
                    key={watch.id}
                    type="button"
                    className="map-feed-row"
                    onClick={() => onOpenWatch?.(watch)}
                  >
                    <span className="map-feed-title">{watch.name}</span>
                    <span className="map-feed-meta">{watch.query}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {brief.hypotheses.length > 0 ? (
              <div>
                <div className="map-stat-title">
                  Hypotheses{brief.hypothesisName ? ` · ${brief.hypothesisName}` : ""}
                </div>
                <ul className="map-brief-hypotheses">
                  {brief.hypotheses.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {onStartReport && brief.stories.length > 0 ? (
              <button type="button" className="map-brief-action" onClick={onStartReport}>
                Start a report · {brief.stories.length}
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
