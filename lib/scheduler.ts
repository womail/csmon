import "server-only";

import { TTL } from "./cache";
import { fetchKevCatalog } from "./kev-fetch";
import { kevFetchedAt, listDueSources, replaceKev } from "./queries";
import { pendingReclassifyCount, reclassifyBatch } from "./reclassify-backfill";
import { refreshSources, type RefreshResult } from "./scrape/refresh";

const TICK_MS = 60 * 1000;
/** Cap per tick so a backlog after downtime drains over a few minutes instead of one burst. */
const MAX_PER_TICK = 24;
/** Stored items re-scored per tick after a classifier version bump. */
const RESCORE_PER_TICK = 2000;

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

/** Last time this process tried to reload KEV, so a down catalog is not fetched every tick. */
let lastKevAttemptAt = 0;

/** Replace the KEV snapshot when it is older than the catalog cache. */
async function refreshKevIfDue() {
  const now = Date.now();
  if (now - kevFetchedAt() < TTL.kev) return;
  if (now - lastKevAttemptAt < TTL.kev) return;
  lastKevAttemptAt = now;
  replaceKev(await fetchKevCatalog());
}

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
  status.running = true;
  const started = Date.now();
  try {
    if (due.length) {
      const result = await refreshSources(
        due.map((source) => source.id),
        { bustCache: false, revalidate: true },
      );
      status.lastRun = { ...result, at: Date.now(), durationMs: Date.now() - started };
    }
    if (pendingReclassifyCount() > 0) reclassifyBatch(RESCORE_PER_TICK);
    try {
      await refreshKevIfDue();
    } catch (error) {
      console.error("[scheduler] KEV refresh failed", error);
    }
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
