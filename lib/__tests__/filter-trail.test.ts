import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { listTrail, pushTrail, trailBack, trailForward } from "../filter-trail";

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  clear() {
    this.data.clear();
  }
}

const memory = new MemoryStorage();
(globalThis as unknown as { sessionStorage: MemoryStorage }).sessionStorage = memory;
const entry = (query: string) => ({ at: Date.now(), query, summary: query, count: 1 });

beforeEach(() => memory.clear());

test("consecutive equal queries collapse", () => {
  pushTrail(entry("?desk=brief"));
  pushTrail(entry("?desk=brief"));
  pushTrail(entry("?desk=scan"));
  assert.equal(listTrail().length, 2);
});

test("back and forward stay in bounds", () => {
  for (const q of ["a", "b", "c", "d", "e"]) pushTrail(entry(q));
  assert.equal(trailBack()?.query, "d");
  assert.equal(trailBack()?.query, "c");
  assert.equal(trailBack()?.query, "b");
  assert.equal(trailForward()?.query, "c");
  trailBack();
  trailBack();
  assert.equal(trailBack(), null);
  for (let i = 0; i < 10; i += 1) trailForward();
  assert.equal(trailForward(), null);
});

test("pushing after going back drops forward entries", () => {
  for (const q of ["a", "b", "c"]) pushTrail(entry(q));
  trailBack();
  pushTrail(entry("x"));
  assert.deepEqual(
    listTrail().map((row) => row.query),
    ["a", "b", "x"],
  );
});
