# Security

csmon is a **local current-situation monitor**. It fetches **public** RSS, JSON, and HTML only. It is not an authenticated multi-tenant SaaS product. Hardening assumes a single operator, preferably bound to localhost.

This file records what was hardened, how to run it safely, and how to report issues.

## What changed

### Outbound fetch (SSRF)

User-supplied URLs (scrape, read-in-place, explore, RSS discovery) go through `lib/safe-url.ts` / `lib/public-url.ts`:

- Only `http` and `https`
- No credentials in the URL
- Ports **80** and **443** only
- Hostnames such as `localhost`, `*.internal`, `*.local`, cloud metadata, and Docker internals are rejected
- Literal and resolved IPs in private, loopback, link-local, unique-local, and multicast ranges are rejected
- Redirects are followed manually (max 5) and **re-checked** at each hop
- Response bodies are capped (about 2–8 MB depending on kind)

The shared HTTP helpers in `lib/http.ts` use this path, including KEV, weather, flights, and translation.

### HTTP API

- Optional shared secret: set `CSMON_TOKEN`. Then `/api/*` requires `Authorization: Bearer …`, `X-Csmon-Token`, or the HttpOnly `csmon_token` cookie from `POST /api/session`.
- `/api/health` stays open so Docker can health-check without the token.
- `/api/session` is rate-limited and does not require a prior cookie (that would deadlock unlock).
- Per-route rate limits (in-process, per source IP).
- JSON bodies are size-capped. IDs, ICAO24, coordinates, intel packs, and scrape input are validated.
- Upstream failures no longer echo raw URLs or status lines back to the browser.

Auth is **not** implemented in `proxy.ts` / middleware. Next.js 16 moved that file to the network boundary after CVE-2025-29927; token checks live in the route handlers and in `app/page.tsx` (empty board HTML if the cookie is missing).

### Browser

`next.config.ts` sets:

- `Content-Security-Policy` via `proxy.ts`: per-request `nonce` + `strict-dynamic` so Next.js hydration scripts run. Development also allows `'unsafe-eval'` because React reconstructs call stacks with `eval()`; production does not.
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` / `frame-ancestors 'none'`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (camera, mic, geolocation, payment, usb off)
- `Cross-Origin-Opener-Policy` / `Cross-Origin-Resource-Policy: same-origin`
- `X-Powered-By` disabled

Leaflet still needs `style-src 'unsafe-inline'` and Esri tile `img-src`.

### Process and data

- SQLite path is `CSMON_DATA_DIR` (default `./data`). WAL and foreign keys stay on.
- Docker image runs as uid **1001**, drops capabilities, and disables new privileges.
- Compose publishes **127.0.0.1:3000** only, not `0.0.0.0`.
- Application updates are **check-only** over HTTP. Apply with `scripts/update.sh` on the host. There is no remote code-exec “upgrade” endpoint.

### Supply chain

- pnpm is pinned in `package.json` (`packageManager`).
- `pnpm generate-sbom` writes CycloneDX 1.6 and SPDX to `sbom/` (pnpm 12's built-in `pnpm sbom`).
- Dependabot watches npm, Docker, and GitHub Actions.
- `iconv-lite` is overridden to 0.7.3 in `pnpm-workspace.yaml` so cheerio’s encoding stack resolves a complete package.

## Recommended deploy

1. Bind to loopback (`127.0.0.1:3000`), which Compose already does.
2. Put a reverse proxy with TLS in front if you leave the machine.
3. Set a long random `CSMON_TOKEN` and `CSMON_SECURE_COOKIE=1` on HTTPS.
4. Do not expose the SQLite volume.
5. Keep using public feeds only. Do not point scrape/RSS at your own admin ports; the SSRF filter will refuse them anyway.

## Threat model (in / out of scope)

| In scope | Out of scope |
| --- | --- |
| SSRF via scrape/read/explore | Multi-user accounts, OAuth, SSO |
| Oversized bodies, obvious abuse of `/api` | Stopping a determined local user who can read `localStorage` |
| Shipping a known-vulnerable dependency unnoticed (SBOM + Dependabot) | Treating the board as an IDS or recon scanner |
| Accidental LAN/cloud-metadata fetch | Reddit OAuth tokens or unofficial scrape proxies |

Public APIs and RSS only. No recon scanners, no unauthorized probing.

## Reporting

Open a private GitHub security advisory on the csmon repository, or contact the operator who runs your instance. Do not file a public issue with a working exploit.

## Updater

`GET /api/update` compares `package.json` version to the latest GitHub release (`CSMON_UPDATE_REPO`, default `womail/csmon`). Options → **Check now** shows the result.

Apply on the host, never through the API:

```bash
bash scripts/update.sh          # git pull --ff-only, install, SBOM, build
bash scripts/update.sh docker   # rebuild and restart the container
bash scripts/update.sh check    # hit local /api/update
```
