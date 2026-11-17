import assert from "node:assert/strict";
import { test } from "node:test";
import { displaySummary } from "../card-summary";

test("NHC product header becomes the outlook sentence", () => {
  const raw =
    "000 ABNT20 KNHC 171148 TWOAT Tropical Weather Outlook NWS National Hurricane Center Miami FL 800 AM EDT Tue Nov 17 2026 For the North Atlantic...Caribbean Sea and the Gulf of America: Tropical cyclone formation is not expected during the next 7 days.";
  assert.equal(
    displaySummary("Atlantic Tropical Weather Outlook", raw),
    "Tropical cyclone formation is not expected during the next 7 days.",
  );
  const signed = `${raw} $$ Forecaster Katz/Kelly`;
  assert.equal(
    displaySummary("Atlantic Tropical Weather Outlook", signed),
    "Tropical cyclone formation is not expected during the next 7 days.",
  );
});

test("a summary that repeats the headline is dropped", () => {
  const title = "M 4.6 - 12 km SSE of Ridgecrest, CA";
  assert.equal(displaySummary(title, title), null);
});

test("zero-casualty boilerplate is dropped", () => {
  assert.equal(displaySummary("Flooding in Spain", "The flood caused 0 deaths and 0 displaced."), null);
});

test("a later sentence survives a zero-casualty line", () => {
  assert.equal(
    displaySummary(
      "Flooding in Spain",
      "The flood caused 0 deaths and 0 displaced. Residents moved to higher ground overnight.",
    ),
    "Residents moved to higher ground overnight.",
  );
});

test("bare urls and copyright lines are dropped", () => {
  assert.equal(displaySummary("Stormcast", "https://isc.sans.edu/podcastdetail/example"), null);
  assert.equal(
    displaySummary("Stormcast", "Copyright SANS Institute. All rights reserved."),
    null,
  );
});

test("a spoken sentence is kept", () => {
  assert.equal(
    displaySummary("Valencia floods", "Heavy rain flooded streets in Valencia overnight."),
    "Heavy rain flooded streets in Valencia overnight.",
  );
});
