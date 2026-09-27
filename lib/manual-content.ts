/** In-app user manual and maintainer guide (rendered at /help). */

export type ManualSection = {
  slug: string;
  title: string;
  audience: "user" | "maintainer" | "both";
  summary: string;
  body: string;
};

export const MANUAL_SECTIONS: ManualSection[] = [
  {
    slug: "start",
    title: "Getting started",
    audience: "user",
    summary: "What csmon is and how desks work.",
    body: `csmon is a **current situation monitor**: RSS and public feeds collapse into desks (Home, Brief, Patch, and others). Click a story to read in place; filters live in the URL so you can bookmark a view.

**First session:** open **Options** → set home location, language, and optional software stack for Patch. Use **Refresh** after enabling sources under **Sources** or loading intel packs from Home.`,
  },
  {
    slug: "desks-filters",
    title: "Desks and filters",
    audience: "user",
    summary: "Topics, places, CVE chips, query builder, saved filters.",
    body: `Use the desk rail to switch context. **Tune** edits place, topic, layer, and query rows. **Filters** saves the current URL under a name.

Switching a built-in desk clears the **Query builder** so an old \`qb=\` string does not linger. Custom desks keep their saved filters.`,
  },
  {
    slug: "sources",
    title: "Sources and RSS layers",
    audience: "both",
    summary: "Enable feeds, source library, import/export.",
    body: `Each **layer** is an RSS (or scraped) source in SQLite. **+ RSS** adds one feed; **Options → Source library** lists every layer with fetch stats.

**Export JSON** backs up custom layers. **Import JSON** restores them on another install (duplicate feed URLs are skipped). Shipped feeds live in \`lib/intel-feeds.ts\` in git — use Export when contributing upstream.`,
  },
  {
    slug: "reports",
    title: "Reports and briefings",
    audience: "user",
    summary: "Compile stories with full page extract.",
    body: `**Report** on the reader adds the story (including page extract, CVEs, links) to a briefing. Reports live in this browser's storage until you archive or print to PDF.`,
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
| \`lib/query-builder.ts\` | Structured \`qb=\` query tree (title/vendor contains, etc.). |
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
| Origin | Why a layer exists: intel, self, follow, explore, reddit. |
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
