import "server-only";

import { itemLimitFromRequest, envBoardItemLimit } from "./board-limit";
import { getMonitorState } from "./queries";
import type { MonitorState } from "./types";

/** Monitor snapshot with item limit from request query or server env default. */
export function monitorStateFromRequest(request: Request): MonitorState {
  return getMonitorState(itemLimitFromRequest(request));
}

export function monitorStateDefault(): MonitorState {
  return getMonitorState(envBoardItemLimit());
}
