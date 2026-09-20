"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Plus, X } from "lucide-react";
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
  label = "Subreddits",
}: {
  busy?: boolean;
  onLoad: (subs: string[]) => Promise<void> | void;
  onListChange?: (subs: string[]) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
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
      setHint(`Kept the first ${MAX_SUBREDDITS}. Combined RSS stays one request.`);
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

  return (
    <>
      <Tip text="Manage subreddits as one combined public RSS">
        <Button size="xs" variant="outline" onClick={() => setOpen(true)}>
          <MessageSquare className="size-3" />
          {label}
        </Button>
      </Tip>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Subreddits</DialogTitle>
            <p className="text-[12px] text-slate-500">
              Combined into one public RSS (hot, 100 items) so Reddit’s one-request-per-minute
              cap is not blown.
            </p>
          </DialogHeader>
          <div className="space-y-3 px-1 pb-1">
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
                <p className="text-[12px] text-slate-400">No subreddits yet.</p>
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
            {hint ? <p className="text-[11px] text-slate-500">{hint}</p> : null}
            <p className="text-[11px] text-slate-400">
              Public RSS only. No account tokens. Wait a minute between loads.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
                Close
              </Button>
              <Button size="sm" onClick={() => void load()} disabled={busy || !subs.length}>
                Load Reddit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
