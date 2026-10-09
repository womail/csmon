#!/usr/bin/env node
/**
 * Probe ACLED OAuth + read using .env.local (same checks as GET /api/acled).
 * Usage: node --env-file=.env.local scripts/test-acled.mjs
 */
const u = process.env.ACLED_USERNAME?.trim();
const p = process.env.ACLED_PASSWORD?.trim();
if (!u || !p) {
  console.error("Set ACLED_USERNAME and ACLED_PASSWORD in .env.local");
  process.exit(1);
}
console.log("username email?", u.includes("@"));

const body = new URLSearchParams({
  username: u,
  password: p,
  grant_type: "password",
  client_id: "acled",
  scope: "authenticated",
});
const tokRes = await fetch("https://acleddata.com/oauth/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
  body,
});
const tokText = await tokRes.text();
console.log("token HTTP", tokRes.status);
if (!tokRes.ok) {
  console.log(tokText.slice(0, 400));
  process.exit(2);
}
const { access_token: token } = JSON.parse(tokText);
const readRes = await fetch("https://acleddata.com/api/acled/read?limit=3", {
  headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
});
const readText = await readRes.text();
console.log("read HTTP", readRes.status, readText.slice(0, 300));
if (readRes.status === 403) {
  console.error(
    "\n403 usually means your myACLED account lacks API access.\nEmail access@acleddata.com from the same address as ACLED_USERNAME.",
  );
  process.exit(3);
}
process.exit(readRes.ok ? 0 : 4);
