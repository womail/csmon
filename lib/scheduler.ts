import "server-only";

import { listDueSources } from "./queries";
import { refreshSources, type RefreshResult } from "./scrape/refresh";

const TICK_MS = 60 * 1000;
/** Cap per tick so a backlog after downtime drains over a few minutes instead of one burst. */
const MAX_PER_TICK = 24;

export type SchedulerStatus = {
  enabled: boolean;
  running: boolean;
  startedAt: number | null;
  lastTickAt: number | null;
  lastRun: (RefreshResult & { at: number; durationMs: number }) | null;
};

const globalForScheduler = globalThis as unknown as {
  csmonScheduler?: { timer: ReturnType<typeof setInterval>; status: SchedulerStatus };
};

export function schedulerEnabled() {
  return process.env.CSMON_SCHEDULER !== "0";
}

export function schedulerStatus(): SchedulerStatus {
  return (
    globalForScheduler.csmonScheduler?.status ?? {
      enabled: false,
      running: false,
      startedAt: null,
      lastTickAt: null,
      lastRun: null,
    }
  );
}

async function tick(status: SchedulerStatus) {
  if (status.running) return;
  status.lastTickAt = Date.now();
  const due = listDueSources().slice(0, MAX_PER_TICK);
  if (!due.length) return;
  status.running = true;
  const started = Date.now();
  try {
    const result = await refreshSources(
      due.map((source) => source.id),
      { bustCache: false, revalidate: true },
    );
    status.lastRun = { ...result, at: Date.now(), durationMs: Date.now() - started };
  } catch (error) {
    console.error("[scheduler] tick failed", error);
  } finally {
    status.running = false;
  }
}

/** Start the server-side refresh loop once per process (survives dev hot reloads). */
export function startScheduler() {
  if (!schedulerEnabled() || globalForScheduler.csmonScheduler) return;
  const status: SchedulerStatus = {
    enabled: true,
    running: false,
    startedAt: Date.now(),
    lastTickAt: null,
    lastRun: null,
  };
  const timer = setInterval(() => void tick(status), TICK_MS);
  timer.unref?.();
  globalForScheduler.csmonScheduler = { timer, status };
  setTimeout(() => void tick(status), 15_000).unref?.();
  console.info("[scheduler] server-side refresh on (CSMON_SCHEDULER=0 to disable)");
}
