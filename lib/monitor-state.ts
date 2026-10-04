import "server-only";

import { itemLimitFromRequest, envBoardItemLimit } from "./board-limit";
import { getMonitorState } from "./queries";
import type { MonitorState } from "./types";

/** Monitor snapshot with item limit from request query or server env default. */
export function monitorStateFromRequest(request: Request): MonitorState {
  const q = new URL(request.url).searchParams.get("q");
  return getMonitorState(itemLimitFromRequest(request), q);
}

export function monitorStateDefault(): MonitorState {
  return getMonitorState(envBoardItemLimit());
}
