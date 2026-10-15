"use client";

import type { DeepDive } from "@/lib/dive";
import type { KevEntry } from "@/lib/kev";
import { languageName } from "@/lib/lang";

export function ReaderAtAGlance({
  dive,
  leadBullets,
  kevHits,
  extractEngine,
}: {
  dive: DeepDive;
  leadBullets: string[];
  kevHits: KevEntry[];
  extractEngine?: "readability" | "cheerio" | null;
}) {
  const places = dive.places.slice(0, 4);
  const topics = dive.topics.slice(0, 4);
  const showMeta =
    dive.readingMinutes > 0 ||
    dive.language.id ||
    places.length > 0 ||
    topics.length > 0 ||
    kevHits.length > 0 ||
    extractEngine;

  if (!showMeta && leadBullets.length === 0) return null;

  return (
    <section className="reader-at-a-glance mx-3 mt-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/40">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-600 dark:text-slate-400">
        <span className="font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
          At a glance
        </span>
        {dive.readingMinutes > 0 ? (
          <span>
            ~{dive.readingMinutes} min read
          </span>
        ) : null}
        {dive.language.id ? (
          <>
            <span aria-hidden>·</span>
            <span>{languageName(dive.language.id)}</span>
          </>
        ) : null}
        {extractEngine === "readability" ? (
          <>
            <span aria-hidden>·</span>
            <span className="text-slate-500" title="Body extracted with Mozilla Readability (Reader View)">
              Clean extract
            </span>
          </>
        ) : null}
        {places.length > 0 ? (
          <>
            <span aria-hidden>·</span>
            <span>{places.join(" · ")}</span>
          </>
        ) : null}
        {topics.length > 0 ? (
          <>
            <span aria-hidden>·</span>
            <span className="text-slate-500">{topics.join(", ")}</span>
          </>
        ) : null}
      </div>
      {kevHits.length > 0 ? (
        <p className="mt-1.5 text-[11px] font-medium text-rose-800 dark:text-rose-300">
          KEV: {kevHits.map((row) => row.cveId).join(", ")}
        </p>
      ) : null}
      {leadBullets.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-4">
          {leadBullets.map((bullet) => (
            <li key={bullet.slice(0, 64)} className="text-[12.5px] leading-snug text-slate-800 dark:text-slate-200">
              {bullet}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
