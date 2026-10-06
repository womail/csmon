"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Plus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { tagStyle } from "@/lib/colors";
import {
  DEFAULT_SUBREDDITS,
  MAX_SUBREDDITS,
  REDDIT_RSS_REPLACEMENTS,
  REDDIT_RSS_SUNSET_BANNER,
  REDDIT_RSS_SUNSET_LABEL,
  gdeltSuggestionsFromSubreddits,
  isRedditRssSunset,
  loadSubreddits,
  parseSubredditInput,
  saveSubreddits,
  uniqueSubreddits,
} from "@/lib/reddit";
import { Tip } from "@/components/monitor/tip";

export function RedditButton({
  busy,
  onLoad,
  onListChange,
  onImportGdelt,
  label,
  open: openControlled,
  onOpenChange,
}: {
  busy?: boolean;
  onLoad: (subs: string[]) => Promise<void> | void;
  onListChange?: (subs: string[]) => void;
  onImportGdelt?: (subs: string[]) => void;
  label?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const sunset = isRedditRssSunset();
  const defaultLabel = sunset ? "Reddit → GDELT" : "Subreddits";
  const resolvedLabel = label ?? defaultLabel;

  const [openInternal, setOpenInternal] = useState(false);
  const open = openControlled ?? openInternal;
  const setOpen = onOpenChange ?? setOpenInternal;

  const [subs, setSubs] = useState<string[]>(DEFAULT_SUBREDDITS);
  const [draft, setDraft] = useState("");
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSubs(loadSubreddits());
    setDraft("");
    setHint(null);
  }, [open]);

  function commitList(next: string[]) {
    const names = uniqueSubreddits(next);
    setSubs(names);
    saveSubreddits(names);
    onListChange?.(names);
    return names;
  }

  function addDraft() {
    const added = parseSubredditInput(draft);
    if (!added.length) {
      setHint("Use a name like worldnews, r/news, or a reddit.com/r/… URL.");
      return;
    }
    const next = uniqueSubreddits([...subs, ...added]);
    if (next.length === subs.length) {
      setHint(subs.length >= MAX_SUBREDDITS ? `Cap is ${MAX_SUBREDDITS} subreddits.` : "Already on the list.");
      return;
    }
    if (subs.length + added.length > MAX_SUBREDDITS) {
      setHint(`Kept the first ${MAX_SUBREDDITS}.`);
    } else {
      setHint(null);
    }
    commitList(next);
    setDraft("");
  }

  async function load() {
    const names = commitList(subs);
    if (!names.length) {
      setHint("Add at least one subreddit.");
      return;
    }
    await onLoad(names);
    setOpen(false);
  }

  function importGdelt() {
    const names = commitList(subs);
    if (!names.length) {
      setHint("Add subreddit names to convert.");
      return;
    }
    onImportGdelt?.(names);
    setHint("Added GDELT query drafts from your sub list — open GDELT to review and Load.");
    setOpen(false);
  }

  const suggestions = gdeltSuggestionsFromSubreddits(subs);

  return (
    <>
      <Tip
        text={
          sunset
            ? "Reddit RSS ended — import sub names to GDELT keyword queries"
            : "Manage subreddits as one combined public RSS"
        }
      >
        <Button size="xs" variant="outline" onClick={() => setOpen(true)}>
          <MessageSquare className="size-3" />
          {resolvedLabel}
        </Button>
      </Tip>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[15px]">
              {sunset ? "Reddit RSS migration" : "Subreddits"}
            </DialogTitle>
            <p className="text-[12px] text-slate-500">
              {sunset ? (
                <>
                  Public Reddit RSS ended {REDDIT_RSS_SUNSET_LABEL}. csmon cannot fetch combined{" "}
                  <code className="text-[10px]">/r/…/.rss</code> feeds anymore.
                </>
              ) : (
                <>
                  Combined into one public RSS (hot, 100 items). {REDDIT_RSS_SUNSET_BANNER}
                </>
              )}
            </p>
          </DialogHeader>
          <div className="space-y-3 px-1 pb-1">
            {!sunset ? (
              <p className="rounded-md border border-orange-200 bg-orange-50 px-2 py-1.5 text-[10px] leading-snug text-orange-950">
                {REDDIT_RSS_REPLACEMENTS}
              </p>
            ) : (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] leading-snug text-amber-950">
                {REDDIT_RSS_REPLACEMENTS}
              </p>
            )}
            <div className="flex flex-wrap gap-1">
              {subs.map((name) => {
                const style = tagStyle("reddit");
                return (
                  <span
                    key={name}
                    className="tag inline-flex items-center gap-0.5"
                    style={{ background: style.bg, color: style.fg }}
                  >
                    r/{name}
                    <button
                      type="button"
                      className="ml-0.5 rounded p-0.5 hover:bg-black/10"
                      onClick={() => commitList(subs.filter((entry) => entry !== name))}
                      aria-label={`Remove r/${name}`}
                    >
                      <X className="size-2.5" />
                    </button>
                  </span>
                );
              })}
              {subs.length === 0 ? (
                <p className="text-[12px] text-slate-400">No subreddit names saved.</p>
              ) : null}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                addDraft();
              }}
            >
              <Input
                className="h-8 text-[12px]"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="worldnews, r/europe, or a Reddit URL"
              />
              <Button type="submit" size="sm" variant="outline">
                <Plus className="size-3" />
                Add
              </Button>
            </form>
            {sunset && suggestions.length ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                <p className="text-[10px] font-medium text-slate-700">Suggested GDELT searches</p>
                <ul className="mt-1 max-h-28 space-y-1 overflow-y-auto text-[10px] text-slate-600">
                  {suggestions.map((row) => (
                    <li key={row.id}>
                      <span className="font-medium">{row.name}</span> →{" "}
                      <span className="font-mono">{row.query}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {hint ? <p className="text-[11px] text-slate-500">{hint}</p> : null}
            {!sunset ? (
              <p className="text-[11px] text-slate-400">
                Public RSS only. Wait a minute between loads.
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
                Close
              </Button>
              {sunset ? (
                <Button size="sm" onClick={() => importGdelt()} disabled={!subs.length}>
                  <Sparkles className="size-3" />
                  Import to GDELT
                </Button>
              ) : (
                <Button size="sm" onClick={() => void load()} disabled={busy || !subs.length}>
                  Load Reddit
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
