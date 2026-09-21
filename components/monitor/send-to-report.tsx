"use client";

import { useEffect, useMemo, useState } from "react";
import { NotebookPen } from "lucide-react";
import { Tip } from "@/components/monitor/tip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Story } from "@/lib/cluster";
import { extractUrlsForStory, fetchArticleReads } from "@/lib/report-extract";
import type { ArticleRead } from "@/lib/article";
import {
  addStoryToReport,
  createReport,
  loadActiveReportId,
  openReports,
  snapshotStory,
  type Report,
} from "@/lib/reports";
import type { Source } from "@/lib/types";

export function SendToReportButton({
  story,
  sources,
  reports,
  article,
  onChange,
  onOpenReport,
}: {
  story: Story;
  sources: Map<number, Source>;
  reports: Report[];
  article?: ArticleRead | null;
  onChange: (rows: Report[]) => void;
  onOpenReport?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState<"new" | string>("new");
  const [added, setAdded] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);
  const [pullError, setPullError] = useState<string | null>(null);

  const live = useMemo(() => openReports(reports), [reports]);
  const already = live.find((row) =>
    row.stories.some((item) => item.id === story.id || item.url === story.url),
  );

  useEffect(() => {
    if (!open) return;
    setAdded(null);
    setPulling(false);
    setPullError(null);
    const active = loadActiveReportId();
    const preferred = live.find((row) => row.id === active) ?? live[0];
    setTarget(preferred ? preferred.id : "new");
    setTitle("");
  }, [open, live]);

  async function submit() {
    if (pulling) return;
    setPulling(true);
    setPullError(null);
    try {
      const seed = article ? [article] : [];
      const missing = extractUrlsForStory(story, article?.url).filter(
        (url) => !seed.some((row) => row.url === url),
      );
      const fetched = missing.length ? await fetchArticleReads(missing) : [];
      const snap = snapshotStory(story, sources, [...seed, ...fetched]);
      if (target === "new") {
        const { rows, report } = createReport(title || story.title, snap, reports);
        onChange(rows);
        setAdded(report.id);
        return;
      }
      onChange(addStoryToReport(target, snap, reports));
      setAdded(target);
    } catch (error) {
      setPullError(error instanceof Error ? error.message : "Could not pull the full copy");
    } finally {
      setPulling(false);
    }
  }

  return (
    <>
      <Tip text={already ? `Already in ${already.title}` : "Add this story to a report"}>
        <Button size="xs" variant={already ? "outline" : "outline"} onClick={() => setOpen(true)}>
          <NotebookPen className="size-3" />
          Report
        </Button>
      </Tip>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Send to report</DialogTitle>
            <p className="text-[12px] text-slate-500">
              Prompt a title for a new briefing, or keep adding stories to an open report. The full
              page extract and source links go with the story.
            </p>
          </DialogHeader>
          {added ? (
            <div className="space-y-3">
              <p className="text-[13px] text-slate-700">
                Added to{" "}
                <span className="font-medium">
                  {reports.find((row) => row.id === added)?.title ?? "report"}
                </span>
                .
              </p>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
                  Keep reading
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    onOpenReport?.(added);
                    setOpen(false);
                  }}
                >
                  Open report
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="line-clamp-2 text-[12px] leading-snug text-slate-600">{story.title}</p>
              {pullError ? <p className="text-[11px] text-rose-600">{pullError}</p> : null}
              {pulling ? (
                <p className="text-[11px] text-slate-500">Pulling the full page extract…</p>
              ) : null}
              {live.length ? (
                <div className="space-y-1">
                  {live.map((row) => (
                    <label key={row.id} className="flex items-center gap-2 text-[12px] text-slate-700">
                      <input
                        type="radio"
                        name="report-target"
                        checked={target === row.id}
                        onChange={() => setTarget(row.id)}
                      />
                      <span className="min-w-0 truncate font-medium">{row.title}</span>
                      <span className="text-[11px] text-slate-400">
                        {row.stories.length} {row.stories.length === 1 ? "story" : "stories"}
                      </span>
                    </label>
                  ))}
                  <label className="flex items-center gap-2 text-[12px] text-slate-700">
                    <input
                      type="radio"
                      name="report-target"
                      checked={target === "new"}
                      onChange={() => setTarget("new")}
                    />
                    New report
                  </label>
                </div>
              ) : (
                <p className="text-[12px] text-slate-500">Start a report with a title, then keep adding stories.</p>
              )}
              {target === "new" ? (
                <label className="block text-[11px] font-medium text-slate-600">
                  Report title
                  <Input
                    className="mt-1 h-8 text-[12px]"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder={story.title.slice(0, 72)}
                    autoFocus
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void submit();
                    }}
                  />
                </label>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setOpen(false)} disabled={pulling}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => void submit()} disabled={pulling}>
                  {pulling
                    ? "Pulling copy…"
                    : target === "new"
                      ? "Create report"
                      : "Add story"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
