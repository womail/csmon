import assert from "node:assert/strict";
import { test } from "node:test";
import { shortSourceName } from "../source-label";

test("long source names break on a word", () => {
  const label = shortSourceName("CERT-FR AVIS DE SÉCURITÉ");
  assert.equal(label.includes("SÉCU…"), false);
  assert.equal(label, "CERT-FR");
});

test("the record uses its short label", () => {
  assert.equal(shortSourceName("The Record by Recorded Future"), "The Record");
});

test("a long untitled name does not cut a word", () => {
  const label = shortSourceName("Regional Observatory for Coastal Warnings Daily");
  assert.equal(label.endsWith("…"), true);
  assert.equal(/\s\S*…$/.test(label) || label.endsWith("…"), true);
  const bare = label.replace(/…$/, "");
  assert.equal(bare, bare.trim());
  assert.equal(/[a-zà-ÿ]-?$/i.test(bare.split(" ").at(-1) ?? ""), true);
});
