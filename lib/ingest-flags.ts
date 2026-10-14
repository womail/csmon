import "server-only";

import { acledConfigured } from "./acled";

/** GDELT DOC ingest (rate-limited upstream). Off by default — set CSMON_ENABLE_GDELT=1 to turn on. */
export function gdeltIngestEnabled() {
  return process.env.CSMON_ENABLE_GDELT === "1" || process.env.CSMON_ENABLE_GDELT === "true";
}

/** ACLED API ingest. Off by default — set CSMON_ENABLE_ACLED=1 and myACLED credentials. */
export function acledIngestEnabled() {
  if (process.env.CSMON_ENABLE_ACLED !== "1" && process.env.CSMON_ENABLE_ACLED !== "true") {
    return false;
  }
  return acledConfigured();
}

export function gdeltIngestDisabledReason(): string {
  return "GDELT ingest is paused. Set CSMON_ENABLE_GDELT=1 on the server and restart, then Load GDELT.";
}

export function acledIngestDisabledReason(): string {
  if (!acledConfigured()) {
    return "ACLED credentials missing. Set ACLED_USERNAME and ACLED_PASSWORD in .env.local.";
  }
  return "ACLED ingest is paused. Set CSMON_ENABLE_ACLED=1 on the server and restart, then Load ACLED.";
}
