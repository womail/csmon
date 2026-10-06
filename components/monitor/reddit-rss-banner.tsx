"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  isRedditRssSunset,
  REDDIT_RSS_SUNSET_BANNER,
  REDDIT_RSS_REPLACEMENTS,
  REDDIT_SUNSET_BANNER_KEY,
  redditRssDaysUntilSunset,
} from "@/lib/reddit";

export function RedditRssBanner({ onMigrate }: { onMigrate?: () => void }) {
  const [hidden, setHidden] = useState(true);
  const [sunset, setSunset] = useState(false);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    const now = Date.now();
    const ended = isRedditRssSunset(now);
    setSunset(ended);
    setDaysLeft(ended ? null : redditRssDaysUntilSunset(now));
    if (ended) {
      setHidden(false);
      return;
    }
    try {
      setHidden(window.localStorage.getItem(REDDIT_SUNSET_BANNER_KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);

  if (hidden) return null;

  function dismiss() {
    if (!sunset) {
      try {
        window.localStorage.setItem(REDDIT_SUNSET_BANNER_KEY, "1");
      } catch {
        /* ignore */
      }
    }
    setHidden(true);
  }

  return (
    <div
      className={`border-b px-3 py-2 text-[11px] leading-snug ${
        sunset
          ? "border-amber-300 bg-amber-50 text-amber-950"
          : "border-orange-200 bg-orange-50 text-orange-950"
      }`}
      role="status"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{REDDIT_RSS_SUNSET_BANNER}</p>
          {!sunset && daysLeft != null && daysLeft > 0 ? (
            <p className="mt-0.5 text-[10px] opacity-90">About {daysLeft} day{daysLeft === 1 ? "" : "s"} left.</p>
          ) : null}
          <p className="mt-1 text-[10px] opacity-90">{REDDIT_RSS_REPLACEMENTS}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onMigrate ? (
            <Button type="button" size="xs" variant="outline" className="h-7 text-[10px]" onClick={onMigrate}>
              {sunset ? "Import to GDELT…" : "Plan migration…"}
            </Button>
          ) : null}
          {!sunset ? (
            <button
              type="button"
              className="rounded p-1 hover:bg-black/5"
              aria-label="Dismiss Reddit RSS notice until reload"
              onClick={dismiss}
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
