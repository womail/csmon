/** In-app user manual and maintainer guide (rendered at /help). */

export type HelpFigure = {
  /** Path under public/, e.g. /help/screenshots/home-dashboard.png */
  src: string;
  alt: string;
  caption?: string;
};

export type ManualSection = {
  slug: string;
  title: string;
  audience: "user" | "maintainer" | "both";
  summary: string;
  body: string;
  figures?: HelpFigure[];
};

export const MANUAL_SECTIONS: ManualSection[] = [
  {
    slug: "start",
    title: "Getting started",
    audience: "user",
    summary: "What csmon is and how desks work.",
    body: `csmon is a **current situation monitor**: public feeds collapse into **desks** (Home, Brief, Patch, and others). The left rail is grouped — **Situation**, **Cyber**, **Tools**, then your custom desks.

**Home** is the situation dashboard: lanes for weather, quakes, war, and unrest, plus a map of where coverage clusters. Click a topic, source, or map dot to filter in place.

**First session:** use **Set up monitoring** on Sources or an empty board, or load RSS packs from the Sources desk. Open **Options** (header **More**) to set **home location**, language, and your **software stack** for Patch. Press **Refresh** after enabling layers.`,
    figures: [
      {
        src: "/help/screenshots/home-dashboard.png",
        alt: "Home desk with desk rail, investigation bar, map, and situation lanes",
        caption: "Home — situation lanes, map, and filter chips. Filters stay in the URL.",
      },
    ],
  },
  {
    slug: "desks-filters",
    title: "Desks and filters",
    audience: "user",
    summary: "Topics, places, CVE chips, query builder, saved filters.",
    body: `Use the **desk rail** to switch context. The **investigation bar** shows desk, time range, unread count, and active report.

**Primary chips** (place, topic, rising, 2+ sources) stay visible; **More filters** opens origin, platform, people, and CVEs. **Tune** edits filters as a form with a live item/story preview. **Saved** stores named filters, your default briefing, and watches.

**Brief** clusters items into stories (lowest noise). **Scan** shows every item. **Pulse** lists what is rising vs the prior half-window — use **Brief · N** on a trend row to apply that filter and jump to Brief.

Switching a built-in desk clears the **Query builder** (\`qb=\`) so an old rule does not linger. Custom desks keep their saved filters.`,
    figures: [
      {
        src: "/help/screenshots/brief-board.png",
        alt: "Brief desk with story cards, topic mix, and map",
        caption: "Brief — clustered stories, freshness gauge, and place map.",
      },
      {
        src: "/help/screenshots/pulse-trends.png",
        alt: "Pulse desk with rising trends and Brief shortcut buttons",
        caption: "Pulse — rising / new / falling trends; **Brief · N** opens the same filter on Brief.",
      },
    ],
  },
  {
    slug: "read-in-place",
    title: "Read in place",
    audience: "user",
    summary: "Dossier reader, context strip, reports, NVD.",
    body: `Click a **story title** (or press **Enter** on the focused card) to open **Read in place**. The reader is a dossier, not a shrink of the card:

- **Context strip** — desk, range, and clickable filter chips; click a chip to close the reader and keep investigating.
- **Contributing sources** — full title and summary from each layer.
- **Page extract** — cached body text, CVEs, and links mined from the live page.
- **NVD** — official JSON for CVEs mentioned in the RSS title/summary (Patch desk also surfaces KEV).

Use **Report** to append the story (with extract) to an open briefing. **View page** opens the original article in a new tab. **Esc** or back walks your trail.`,
    figures: [
      {
        src: "/help/screenshots/reader-in-place.png",
        alt: "Board with read-in-place pane showing story sources and extract",
        caption: "Read in place beside the board — resize the pane from its left edge on wide screens.",
      },
    ],
  },
  {
    slug: "pulse-desk",
    title: "Pulse desk",
    audience: "user",
    summary: "Trends, sparklines, and the Brief bridge.",
    body: `**Pulse** compares the current half of your time range to the half before it. Rows show topics, places, vendors, or people that are **rising**, **new**, or **falling**, with sparklines and ▲/▼ markers.

Click a row to **filter** the board to that signal. Click **Brief · N** to apply the same filter and switch to **Brief** with N matching items in range.

The **rising** chip on other desks keeps only items that carry a hot topic, place, vendor, or person.`,
    figures: [
      {
        src: "/help/screenshots/pulse-trends.png",
        alt: "Pulse rising trends with Brief bridge buttons",
        caption: "Trend row → filter; **Brief · N** → filtered Brief board.",
      },
    ],
  },
  {
    slug: "patch-desk",
    title: "Patch desk (CISA KEV)",
    audience: "user",
    summary: "Known exploited CVEs, stack filter, patch now.",
    body: `**Patch** ranks **CISA Known Exploited Vulnerabilities**. Load KEV from Sources or the setup wizard.

Filter with **Patch now**, **This window**, **KEV backlog**, **ransomware**, and vendor chips. Type your **stack** in Options or the stack field (e.g. \`microsoft, openssl, linux\`) to highlight CVEs that affect you.

Story cards on Brief/Pulse can show a **KEV** badge when copy matches the loaded catalog. The reader links CVEs to NVD and vendor advisories.`,
    figures: [
      {
        src: "/help/screenshots/patch-kev-desk.png",
        alt: "Patch desk showing KEV cards with patch-now badges",
        caption: "Patch — overdue KEV entries sorted for action.",
      },
    ],
  },
  {
    slug: "sources",
    title: "Sources and RSS layers",
    audience: "both",
    summary: "Enable feeds, source library, import/export.",
    body: `Each **layer** is an RSS (or scraped) source in SQLite. The **Sources** desk lists every layer with origin, item count, and latest headline.

**Set up monitoring** runs a short wizard (packs, home place, optional watch). **Corpus analysis** summarizes stored items, cache, and GDELT/ACLED layers, with a link to **/stats**.

**+ RSS** (Options or scrape dialog) adds one feed; **Source library** lists fetch stats. **Export JSON** backs up custom layers; **Import JSON** restores on another install.`,
    figures: [
      {
        src: "/help/screenshots/sources-layers.png",
        alt: "Sources desk with corpus analysis card and layer tiles",
        caption: "Sources — corpus stats, cache health, and per-layer hide/show.",
      },
    ],
  },
  {
    slug: "reports",
    title: "Reports and briefings",
    audience: "user",
    summary: "Compile stories with full page extract.",
    body: `**Report** on the reader adds the story (including page extract, CVEs, links) to a briefing. Open **Reports** on the desk rail to edit, reorder, set **confidence** (Verified / Likely / Needs work / Noise), switch **Timeline** view, or **Print to PDF**.

Reports sync to SQLite when the API is available; the browser cache loads first. Items cited in a report are protected from retention purge.`,
  },
  {
    slug: "options-limits",
    title: "Options and board limits",
    audience: "user",
    summary: "Retention, item cap, updates.",
    body: `**Default item retention** trims old SQLite rows when you run retention in the source library.

**Board item limit** controls how many recent items load from enabled sources (default 500). Raise it if Scan feels truncated; very high values use more memory.

**Application updates** compare your running version to a manifest or GitHub release — the app never self-patches over HTTP.`,
  },
  {
    slug: "maintainer-overview",
    title: "Maintainer overview",
    audience: "maintainer",
    summary: "Who does what on a private install.",
    body: `**Operators** run Docker or \`pnpm start\`, set \`CSMON_TOKEN\` on untrusted networks, and back up the \`csmon-data\` volume.

**Feed maintainers** curate \`lib/intel-feeds.ts\` or use Source library → Export → PR.

**Release maintainers** publish version tags, optional static \`csmon-update.json\`, and rebuild images. Users apply updates on the host (see **Deploy & update**).`,
  },
  {
    slug: "maintainer-code",
    title: "Source & filter code map",
    audience: "maintainer",
    summary: "Which files to edit for feeds, tags, desks, and URL filters.",
    body: `### Default RSS catalog (ship with git)

| File | Role |
| --- | --- |
| \`lib/intel-feeds.ts\` | Shipped RSS layers (packs: core, security, hazard, …). Primary maintainer surface. |
| \`lib/queries.ts\` | Registers intel feeds into SQLite; \`listItems\` limit for the board. |
| \`app/api/intel/route.ts\` | Loads a pack into the database when user clicks World/Security RSS. |
| \`lib/feed-overrides.ts\` | Reads \`CSMON_DATA_DIR/overrides/feeds.json\`; merged over shipped feeds at runtime. |
| \`data/overrides/feeds.json\` | Instance file (Docker volume). Source library → **Save instance overrides**. |

### Instance-only layers (no git)

| File / UI | Role |
| --- | --- |
| Source library | Add/Edit/Import/Export; writes \`sources\` table via \`lib/source-catalog.ts\`. |
| \`lib/source-import.ts\` | Parses Import JSON. |
| \`app/api/source-catalog/route.ts\` | CRUD + import API. |

### Classification & mining (what tags appear on items)

| File | Role |
| --- | --- |
| \`lib/classify.ts\` | Topic tags (cyber, weather, AI, …) from copy. |
| \`lib/places.ts\` | Places, pinned Ireland/UK/US, text aliases. |
| \`lib/lanes.ts\` | Home lanes: weather, war, unrest, quakes. |
| \`lib/mine.ts\` | Vendors, CVEs, ransomware, advisory-shaped items. |
| \`lib/people.ts\` | Author / person names from RSS. |

### Filtering (board + URL)

| File | Role |
| --- | --- |
| \`lib/board-state.ts\` | Desk list, \`BoardFilters\`, parse/sync URL query params. |
| \`lib/query-builder.ts\` | Structured \`qb=\` query tree plus typed search line (\`source:cisa cve:2024-\`). |
| \`lib/evidence.ts\` | Persisted page extracts, FTS5 index, purge protection. |
| \`lib/entities.ts\` | People, orgs, places, CVEs, IOCs mined on ingest. |
| \`lib/watchlists.ts\` | Named watches, hit log, optional ntfy. |
| \`components/monitor/monitor.tsx\` | Applies filters client-side to items and stories. |
| \`lib/cluster.ts\` | Story clustering for Brief. |

### Workflows

| Task | Action |
| --- | --- |
| Ship new default RSS | Edit \`intel-feeds.ts\` → release → users rebuild or pull |
| One server only | Source library or Import JSON |
| Move layers between hosts | Export JSON → Import JSON |
| Change topic rules | Edit \`classify.ts\` / \`places.ts\` (requires deploy) |`,
  },
  {
    slug: "maintainer-sources",
    title: "Maintaining source catalog",
    audience: "maintainer",
    summary: "intel-feeds, library, import/export workflow.",
    body: `Each feed needs **name**, **site URL**, **feed URL**, and **pack**. After deploy, enable layers and **Refresh**.

See **Source & filter code map** for the full file list.`,
  },
  {
    slug: "lexicon",
    title: "Lexicon",
    audience: "both",
    summary: "Terms used in the UI and docs.",
    body: `| Term | Meaning |
| --- | --- |
| Desk | A board view (Home, Brief, Patch, Sources, …). |
| Layer | One source (usually RSS) in SQLite; shown as a source chip. |
| Story | Cluster of items about the same event (Brief/reader). |
| Item | Single headline row from one layer (Scan). |
| Pack | Intel group in \`intel-feeds.ts\` (core, security, hazard). |
| Origin | Why a layer exists: intel, self, follow, explore, reddit, gdelt. |
| KEV | CISA Known Exploited Vulnerabilities catalog (Patch desk). |
| Cross / 2+ sources | Only stories cited by at least two layers. |
| Rising | Topic/place/vendor/person volume up vs prior half-window. |
| Query builder (\`qb\`) | Advanced AND/OR rules in the URL. |
| Triage | Hide or Read on a card (browser local). |
| Retention | Max age of stored items per layer (purge in source library). |
| Board item limit | Max recent items loaded from DB onto the board. |
| Manifest | Static JSON for version check on private installs. |`,
  },
  {
    slug: "maintainer-updates",
    title: "Deploy and update",
    audience: "maintainer",
    summary: "Private update URL, Docker, what users run.",
    body: `### Why not 127.0.0.1?

Users open csmon at **https://csmon.lof.ie** (or similar). Update **checks** must use a **public HTTPS URL** you control — not localhost inside the container.

### Private update manifest

1. Copy \`public/csmon-update.example.json\` to your site, e.g. \`https://csmon.lof.ie/csmon-update.json\`.
2. On the server set \`CSMON_UPDATE_MANIFEST_URL\` to that URL.
3. Optionally \`CSMON_UPDATE_MANIFEST_ALLOW_SUFFIX=.lof.ie\` so operators can override the URL in Options (same domain only).
4. When you release, edit the JSON: **version**, **publishedAt**, **commit**, **releaseNotes**, **apply** steps.

The app compares manifest **version** to the built \`package.json\` version. Applying updates remains **on the host**: \`scripts/update.sh docker\`, rsync + compose build, or your CI — never a remote exec endpoint.

### GitHub fallback

Set \`CSMON_UPDATE_REPO=owner/repo\` to check GitHub releases when no manifest is configured.

### Docker checklist

| Step | Action |
| --- | --- |
| Data | Keep volume \`csmon_csmon-data\`; \`chown 1001:1001\` on host if needed |
| Bind | \`CSMON_BIND_HOST=0.0.0.0\`; publish with compose \`3000:3000\` |
| Token | \`CSMON_TOKEN\` if LAN is not fully trusted |`,
  },
  {
    slug: "maintainer-wizards",
    title: "Suggested wizards (checklists)",
    audience: "maintainer",
    summary: "Gather-before-you-start lists.",
    body: `**New private instance:** Docker host, domain/TLS, \`CSMON_TOKEN\`, volume backup plan, manifest URL, Import JSON from old instance (if any).

**New RSS layer:** display name, canonical site URL, verified feed URL, pack/category, retention days, test Refresh.

**Release build:** merge to main, \`pnpm build\`, tag version, update manifest JSON on CDN, rebuild image, smoke \`/api/health\`, notify users with \`apply\` text from manifest.

**Incident / bad feed:** disable layer in Source library, Purge stale items, fix feed URL, Apply & refresh.`,
  },
];

export function sectionBySlug(slug: string) {
  return MANUAL_SECTIONS.find((s) => s.slug === slug);
}
