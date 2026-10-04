"use client";

import { useState } from "react";
import { Bell, Eye } from "lucide-react";
import { Tip } from "@/components/monitor/tip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-client";
import type { Desk, Watchlist } from "@/lib/types";

export function WatchButton({
  query,
  desk,
  watches,
  onChange,
  onOpenWatch,
}: {
  query: string;
  desk: Desk;
  watches: Watchlist[];
  onChange: (rows: Watchlist[]) => void;
  onOpenWatch: (watch: Watchlist) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [notifyUrl, setNotifyUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fresh = watches.reduce((sum, row) => sum + row.newHits, 0);

  async function post(body: Record<string, unknown>) {
    const res = await apiFetch("/api/watchlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { watches?: Watchlist[]; error?: string };
    if (!res.ok) throw new Error(data.error || res.statusText);
    onChange(data.watches ?? []);
  }

  async function create() {
    if (!query.trim()) {
      setError("Type a search or query first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await post({
        name: name.trim() || query.trim(),
        query: query.trim(),
        notifyUrl: notifyUrl.trim() || null,
        desk,
      });
      setName("");
      setNotifyUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save watch");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Tip text="Watch this query. New matches stay on the board and can ping ntfy.">
        <Button size="xs" variant="outline" onClick={() => setOpen(true)}>
          <Eye className="size-3" />
          Watch
          {fresh ? <span className="text-[10px] text-orange-600">{fresh}</span> : null}
        </Button>
      </Tip>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[15px]">Watchlists</DialogTitle>
            <p className="text-[12px] text-slate-500">
              Keep matching items off the retention purge. Optional{" "}
              <code className="text-[11px]">https://ntfy.sh/your-topic</code> for a ping.
            </p>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block text-[11px] font-medium text-slate-600">
              Name
              <Input
                className="mt-1 h-8 text-[12px]"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={query.trim().slice(0, 60) || "Ireland ransomware"}
              />
            </label>
            <p className="text-[11px] text-slate-500">
              Query: <span className="font-mono text-slate-700">{query.trim() || "(empty)"}</span>
            </p>
            <label className="block text-[11px] font-medium text-slate-600">
              ntfy URL (optional)
              <Input
                className="mt-1 h-8 text-[12px]"
                value={notifyUrl}
                onChange={(event) => setNotifyUrl(event.target.value)}
                placeholder="https://ntfy.sh/…"
              />
            </label>
            {error ? <p className="text-[11px] text-rose-600">{error}</p> : null}
            <div className="flex justify-end">
              <Button size="sm" onClick={() => void create()} disabled={busy}>
                <Bell className="size-3" />
                Watch this query
              </Button>
            </div>
            {watches.length ? (
              <ul className="divide-y divide-slate-100 border-t border-slate-100 pt-2">
                {watches.map((watch) => (
                  <li key={watch.id} className="flex items-center gap-2 py-1.5 text-[12px]">
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left font-medium text-slate-700 hover:text-slate-900"
                      onClick={() => {
                        onOpenWatch(watch);
                        setOpen(false);
                      }}
                    >
                      {watch.name}
                      {watch.newHits ? (
                        <span className="ml-1 text-[10px] font-normal text-orange-600">
                          {watch.newHits} new
                        </span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      className="text-[10px] text-slate-400 hover:text-rose-600"
                      onClick={() => void post({ delete: watch.id })}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
