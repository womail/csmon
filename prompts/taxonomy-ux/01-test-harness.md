# 01 — Test harness and golden headlines

## Goal

Add `pnpm test` so every later task can prove that classification got better and nothing else broke. No test runner exists yet.

## Steps

1. Add `tsx` as a dev dependency: `pnpm add -D tsx`.
2. In `package.json` → `scripts`, add:

   ```json
   "test": "node --conditions=react-server --import tsx --test \"lib/**/*.test.ts\""
   ```

   - `tsx` resolves extensionless imports and the `@/` path alias from `tsconfig.json`. Plain `node` cannot load this tree.
   - `--conditions=react-server` makes `import "server-only"` resolve to its empty module, so pure helpers that sit next to server code can still be imported. Keep tests on **pure** modules; do not open `data/csmon.sqlite` from a test.
3. Create `lib/__tests__/fixtures/headlines.ts` exporting:

   ```ts
   export type HeadlineCase = {
     title: string;
     summary?: string;
     /** Feed URL or intel handle of the layer, when the source should influence the answer. */
     source?: { handle?: string; feedUrl?: string; category?: string };
     /** Topics that must be present. */
     topics: string[];
     /** Topics that must be absent. */
     notTopics?: string[];
     places?: string[];
     notPlaces?: string[];
   };
   export const HEADLINES: HeadlineCase[] = [ /* … */ ];
   ```

4. Seed it with **all** of these cases (real titles from the corpus, plus controls). Add more as you find them.

   | title (summary) | topics | notTopics | places / notPlaces |
   | --- | --- | --- | --- |
   | SVD-2026-0614: OS Command Injection in the btool Configuration Helper in Splunk AI Toolkit | cyber | health, conflict | |
   | Patch Tuesday - October 2026 | cyber | health | |
   | Introducing ITDR Lookback: Find Out Who Was in Your Microsoft 365 Tenant Before You Were | cyber | health | |
   | WHO declares mpox outbreak a public health emergency | health | | |
   | World Health Organization warns of cholera spread in Sudan | health | | Sudan |
   | ZDI-26-751: Microsoft Windows dxgkrnl Time-Of-Check Time-Of-Use Local Privilege Escalation Vulnerability | cyber | conflict, war | |
   | Defender Exclusion Abuse: How Attackers Hide Malware from MDAV | cyber | sports, conflict | |
   | Knicks employees to get NBA championship rings after phishing email 'mistake' | sports, cyber | | |
   | Arsenal join Man City at Premier League summit, Spurs shock Chelsea 2-0 | sports | diplomacy | |
   | Vulnérabilité dans Ivanti Connect Secure (ICS) (14 octobre 2026) | cyber | diplomacy | |
   | Multiples vulnérabilités dans Citrix NetScaler ADC et Gateway | cyber | diplomacy | |
   | UN Security Council meets on Gaza ceasefire | diplomacy, war | | Gaza |
   | The Endless Chip War | tech | war, conflict | |
   | Etsy to restrict AI-generated content in effort to combat seller slop | ai | war, conflict | |
   | The multi-layered defenses that harden Chrome against abusive notifications | tech | war, defense | |
   | Russian airstrike hits Kharkiv apartment block | war, conflict | | Ukraine, Russia |
   | Ravens rule out QB Jackson (ankle) Sunday vs. Bengals; Huntley to start | sports | | |
   | Senate passes appropriations bills as Jets scramble over Taiwan Strait | politics, defense | sports | Taiwan |
   | Army chiefs and commanders meet at NATO summit | defense, diplomacy | sports | |
   | Cardinals gather in Rome to elect new pope | | sports | Italy |
   | Heat warning issued for Phoenix as temperatures top 115F | weather | sports | |
   | Miami Heat beat Celtics in overtime | sports | weather | |
   | Job market cools as hiring slows | markets | | |
   | Christmas market reopens in Berlin | | markets | Germany |
   | Study finds microplastics in clouds | science | | |
   | Protesters clash with police in Nairobi over tax bill | unrest, politics | | |
   | Apple unveils M6 chip | tech | | |
   | Tear gas fired at protesters in Tbilisi | unrest | energy | |
   | OPEC+ agrees output cut as oil prices slide | energy, markets | | |
   | ISC Stormcast For Friday, October 16th, 2026 (summary: "Tell us what you think of today's podcast") | cyber | | notPlaces: US |
   | U.S. imposes new sanctions on Iranian oil exports | politics, energy | | US, Iran |
   | Java deserialization flaw in Apache Commons | cyber | | notPlaces: Indonesia |
   | Hamas says talks stalled | conflict | | Gaza |
   | Turkey prices rise ahead of Thanksgiving | | | notPlaces: Turkey |
   | Erdogan hosts Putin for summit in Ankara | diplomacy | | Turkey, Russia |
   | Shannon Sharpe signs new podcast deal | | | notPlaces: Ireland |
   | Flights diverted from Shannon Airport after storm | weather | | Ireland |
   | Strait of Hormuz tanker seized | | | Hormuz; notPlaces: Taiwan |

   Leave `topics: []` meaning "no required topic" for rows that only test negatives. Use `source: { handle: "bbc-sport" }` style hints only where the row note says the source matters (task 06 adds category hints).

5. Create `lib/__tests__/classify.test.ts` using `node:test` and `node:assert/strict`. For each case call the public entry the ingest path uses (`classifyItem(title, summary)` today; task 02 replaces it) and assert required topics present and forbidden topics absent (places are checked in `places.test.ts`). Print a compact table of failures (title, got, expected) so a failing run is readable.
6. Today many cases fail. That is expected. Mark the test file with a top-level `const KNOWN_FAILING = new Set<string>([...titles])` that skips (via `t.todo`) the rows failing on the current classifier, so `pnpm test` exits 0. Task 02 empties that set.
7. Add a second test file `lib/__tests__/places.test.ts` that only checks `places` / `notPlaces`, with the same `KNOWN_FAILING` pattern. Task 05 empties it.

## Acceptance

- `pnpm test` runs both files and exits 0; the output lists how many rows are `todo`.
- No test touches SQLite, network, or `window`.
- `prompts/develop.md` already says pure functions need a Node test; add one line to `csmon.md` → **Run**: "`pnpm test` runs the Node unit tests in `lib/**/*.test.ts`."
