import assert from "node:assert/strict";
import { test } from "node:test";
import { boardQueryString, parseBoardFilters } from "../board-state";
import { facetsFromFilters } from "../facets";
import { dismissVisit, recordVisit, shouldOfferSave, viewSignature, type VisitMap } from "../view-visits";

const DAY = 24 * 60 * 60 * 1000;
const t0 = Date.UTC(2026, 9, 1, 9);

function signatureOf(qs: string) {
  const filters = parseBoardFilters(Object.fromEntries(new URLSearchParams(qs)));
  return viewSignature(filters.desk, facetsFromFilters(filters).map((f) => f.token));
}

test("three distinct days within 14 days", () => {
  const sig = signatureOf("desk=brief&topic=war&place=Ukraine");
  let map: VisitMap = {};
  map = recordVisit(map, sig, t0);
  map = recordVisit(map, sig, t0 + 1000);
  map = recordVisit(map, sig, t0 + DAY);
  assert.equal(shouldOfferSave(map, sig, t0 + DAY), false);
  map = recordVisit(map, sig, t0 + 3 * DAY);
  assert.equal(shouldOfferSave(map, sig, t0 + 3 * DAY), true);
  assert.equal(shouldOfferSave(map, sig, t0 + 20 * DAY), false);
});

test("dismissal sticks", () => {
  const sig = signatureOf("desk=brief&topic=war");
  let map: VisitMap = {};
  for (let d = 0; d < 3; d += 1) map = recordVisit(map, sig, t0 + d * DAY);
  map = dismissVisit(map, sig);
  assert.equal(shouldOfferSave(map, sig, t0 + 2 * DAY), false);
});

test("range and camera do not change the signature", () => {
  assert.equal(signatureOf("desk=brief&topic=war&range=7d"), signatureOf("desk=brief&topic=war"));
  assert.equal(signatureOf("desk=brief&topic=war&lat=1&lng=2&z=4"), signatureOf("topic=war&desk=brief"));
  assert.notEqual(boardQueryString(parseBoardFilters({ range: "7d" })), "");
});
