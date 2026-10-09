"use client";

import { useEffect, useState } from "react";
import {
  getStoryHypothesisTag,
  setStoryHypothesisTag,
  HYPOTHESIS_TAG_LABEL,
  type HypothesisTag,
} from "@/lib/hypothesis-notes";

export function HypothesisReaderStrip({
  filterId,
  filterName,
  hypotheses,
  storyId,
}: {
  filterId: string;
  filterName: string;
  hypotheses: string[];
  storyId: string;
}) {
  const [tag, setTag] = useState<HypothesisTag | null>(null);

  useEffect(() => {
    setTag(getStoryHypothesisTag(filterId, storyId));
  }, [filterId, storyId]);

  if (!hypotheses.length) return null;

  function pick(next: HypothesisTag) {
    const value = tag === next ? null : next;
    setStoryHypothesisTag(filterId, storyId, value);
    setTag(value);
  }

  return (
    <section className="hypothesis-reader-strip border-b border-border px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Hypotheses · {filterName}
      </p>
      <ul className="mt-1 space-y-0.5 text-[11px] text-foreground">
        {hypotheses.map((line) => (
          <li key={line} className="leading-snug">
            {line}
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-1">
        {(Object.keys(HYPOTHESIS_TAG_LABEL) as HypothesisTag[]).map((id) => (
          <button
            key={id}
            type="button"
            className={`hypothesis-tag-btn ${tag === id ? "hypothesis-tag-btn-active" : ""}`}
            onClick={() => pick(id)}
          >
            {HYPOTHESIS_TAG_LABEL[id]}
          </button>
        ))}
      </div>
    </section>
  );
}
