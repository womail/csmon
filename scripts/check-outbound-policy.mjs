/**
 * Assert parsePublicHttpUrl rejects private, link-local, credentialed,
 * and odd-port URLs, and accepts ordinary public http(s). No network.
 */
import { OutboundBlockedError, parsePublicHttpUrl } from "../lib/public-url.ts";

const blocked = [
  ["loopback", "http://127.0.0.1/"],
  ["metadata", "http://169.254.169.254/latest/meta-data"],
  ["rfc1918", "http://10.1.2.3/admin"],
  ["rfc1918-192", "http://192.168.0.1/"],
  ["ipv6 loopback", "http://[::1]/"],
  ["unique local", "http://[fd00::1]/"],
  ["localhost name", "http://localhost/"],
  ["local tld", "http://printer.local/"],
  ["internal tld", "http://db.internal/"],
  ["cloud metadata name", "http://metadata.google.internal/"],
  ["credentials", "https://user:secret@example.com/feed"],
  ["odd port", "https://example.com:8443/feed"],
  ["file scheme", "file:///etc/passwd"],
  ["javascript scheme", "javascript:alert(1)"],
];

const allowed = [
  "https://example.com/rss.xml",
  "http://example.com/atom",
  "https://api.first.org/data/v1/epss",
  "https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-ireland",
];

let failed = 0;

for (const [label, raw] of blocked) {
  try {
    parsePublicHttpUrl(raw);
    console.error(`  fail allowed ${label}: ${raw}`);
    failed += 1;
  } catch (error) {
    if (!(error instanceof OutboundBlockedError)) {
      console.error(`  fail ${label} threw ${error?.name ?? "unknown"}`);
      failed += 1;
    } else {
      console.log(`  ok   blocked ${label}`);
    }
  }
}

for (const raw of allowed) {
  try {
    parsePublicHttpUrl(raw);
    console.log(`  ok   allowed ${raw}`);
  } catch (error) {
    console.error(`  fail rejected public URL ${raw}: ${error.message}`);
    failed += 1;
  }
}

const huge = `https://example.com/${"a".repeat(3000)}`;
try {
  parsePublicHttpUrl(huge);
  console.error("  fail allowed an over-long URL");
  failed += 1;
} catch (error) {
  if (error instanceof OutboundBlockedError) console.log("  ok   blocked over-long URL");
  else {
    console.error("  fail over-long URL threw the wrong error");
    failed += 1;
  }
}

if (failed) {
  console.error(`\noutbound policy failed (${failed})`);
  process.exit(1);
}
console.log("\noutbound policy passed");
