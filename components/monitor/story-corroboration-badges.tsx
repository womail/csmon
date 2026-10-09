"use client";

import { Tip } from "@/components/monitor/tip";
import { shortSourceName } from "@/lib/source-label";
import type { StoryCorroboration } from "@/lib/story-corroboration";

export function StoryCorroborationBadges({
  corroboration,
}: {
  corroboration: StoryCorroboration;
}) {
  const { sourceCount, sourceNames, rising, kevCves } = corroboration;
  const sourceTip =
    sourceNames.length > 0
      ? sourceNames.map((name) => shortSourceName(name)).join(" · ")
      : "Independent layers";

  if (sourceCount < 2 && !rising && kevCves.length === 0) return null;

  return (
    <div className="story-corr-badges" onClick={(event) => event.stopPropagation()}>
      {sourceCount >= 2 ? (
        <Tip text={`Corroborated by ${sourceCount} layers: ${sourceTip}`}>
          <span className="story-corr-badge story-corr-badge-sources">
            {sourceCount} sources
          </span>
        </Tip>
      ) : null}
      {rising ? (
        <Tip text="Carries a topic, place, vendor, or person that is rising or new in this window">
          <span className="story-corr-badge story-corr-badge-rising">Rising</span>
        </Tip>
      ) : null}
      {kevCves.length > 0 ? (
        <Tip text={`CVE on CISA KEV: ${kevCves.join(", ")}`}>
          <span className="story-corr-badge story-corr-badge-kev">KEV</span>
        </Tip>
      ) : null}
    </div>
  );
}
