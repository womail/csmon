"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DiscoveredSource, OriginReason } from "@/lib/types";

const REASONS: { id: OriginReason | "all"; label: string }[] = [
  { id: "all", label: "all" },
  { id: "self", label: "self" },
  { id: "mention", label: "mention" },
  { id: "follow", label: "follow" },
  { id: "link", label: "link" },
];

const SUGGESTIONS: Record<"rss" | "bsky" | "auto", string[]> = {
  rss: [
    "https://krebsonsecurity.com/feed/",
    "https://www.cisa.gov/cybersecurity-advisories/all.xml",
    "https://www.bleepingcomputer.com/feed/",
    "https://feeds.bbci.co.uk/news/world/rss.xml",
  ],
  bsky: ["nytimes.com", "reuters.com", "theguardian.com", "bbc.com"],
  auto: ["nytimes.com", "bbc.com", "reuters.com", "krebsonsecurity.com/feed/"],
};

type ScrapeMode = "rss" | "bsky" | "auto";

export function ScrapeDialog({
  open,
  onOpenChange,
  busy,
  error,
  discovered,
  onScrape,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  error: string | null;
  discovered: DiscoveredSource[];
  onScrape: (input: string, mode?: ScrapeMode) => Promise<void>;
  onAdd: (keys: string[]) => Promise<void>;
}) {
  const [mode, setMode] = useState<ScrapeMode>("rss");
  const [input, setInput] = useState("");
  const [reason, setReason] = useState<OriginReason | "all">("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelected(
      new Set(discovered.filter((s) => s.reason === "self").map((s) => s.key)),
    );
  }, [discovered]);

  const filtered = useMemo(() => {
    return discovered
      .filter((s) => (reason === "all" ? true : s.reason === reason))
      .filter((s) => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          (s.handle ?? "").toLowerCase().includes(q) ||
          (s.sample ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.weight - a.weight);
  }, [discovered, query, reason]);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-slate-100 px-4 py-3">
          <DialogTitle className="text-[15px]">Add sources</DialogTitle>
          <p className="text-[12px] text-slate-500">
            Paste a public RSS/Atom URL, a site that publishes a feed, or a Bluesky
            handle. You pick which discoveries become layers.
          </p>
        </DialogHeader>
        <div className="flex gap-1 px-4 pt-3">
          {(
            [
              { id: "rss" as const, label: "RSS feed" },
              { id: "bsky" as const, label: "Bluesky" },
              { id: "auto" as const, label: "Auto" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMode(item.id)}
              className={`rounded-full px-2 py-0.5 text-[11px] ${
                mode === item.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2 px-4 pt-2"
          onSubmit={async (event) => {
            event.preventDefault();
            await onScrape(input, mode);
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              mode === "rss"
                ? "https://krebsonsecurity.com/feed/ or example.com"
                : mode === "bsky"
                  ? "@handle or bsky.app/profile/…"
                  : "@handle, site, or RSS URL"
            }
            className="h-8 text-[13px]"
          />
          <Button type="submit" size="sm" disabled={busy || !input.trim()}>
            {busy ? "Scraping…" : mode === "rss" ? "Add RSS" : "Scrape"}
          </Button>
        </form>
        <div className="flex flex-wrap gap-1 px-4 pt-2">
          {SUGGESTIONS[mode].map((handle) => (
            <button
              key={handle}
              type="button"
              className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-200"
              onClick={() => setInput(handle)}
            >
              {handle}
            </button>
          ))}
        </div>
        {error ? (
          <p className="px-4 pt-2 text-[12px] text-red-600">{error}</p>
        ) : null}

        {discovered.length > 0 ? (
          <div className="flex min-h-0 flex-1 flex-col px-4 pt-3 pb-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-[12px] text-slate-500">
                {discovered.length} sources · {filtered.length} shown
              </div>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter sources"
                className="h-7 w-40 text-[12px]"
              />
            </div>
            <div className="mb-2 flex gap-1">
              {REASONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setReason(r.id)}
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    reason === r.id
                      ? "bg-slate-800 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {r.label}
                  {r.id !== "all"
                    ? ` ${discovered.filter((s) => s.reason === r.id).length}`
                    : ""}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto rounded-md border border-slate-100 p-1">
              {filtered.map((source) => {
                return (
                  <label
                    key={source.key}
                    className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50"
                  >
                    <Checkbox
                      checked={selected.has(source.key)}
                      onCheckedChange={() => toggle(source.key)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[12.5px] font-medium text-slate-800">
                          {source.name}
                        </span>
                        <span className="shrink-0 text-[10px] tracking-wide text-slate-400 uppercase">
                          {source.reason} · {source.weight}
                        </span>
                      </div>
                      <div className="truncate text-[11px] text-slate-500">
                        {source.handle} · {source.platform}
                        {source.feedUrl ? " · rss" : ""}
                      </div>
                      {source.sample ? (
                        <div className="truncate text-[11px] text-slate-400">
                          {source.sample}
                        </div>
                      ) : null}
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                className="text-[12px] text-slate-500 hover:text-slate-800"
                onClick={() => setSelected(new Set(filtered.map((s) => s.key)))}
              >
                Select shown
              </button>
              <Button
                size="sm"
                disabled={busy || selected.size === 0}
                onClick={() => onAdd([...selected])}
              >
                Add {selected.size} as layers
              </Button>
            </div>
          </div>
        ) : (
          <p className="px-4 py-6 text-[12px] text-slate-500">
            Try a newsroom handle like <span className="font-medium">nytimes.com</span> — csmon
            will list who they mention and follow so you can filter the board down.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
