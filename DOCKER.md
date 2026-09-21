# Docker

Build and run csmon as a local container. The image is a Next.js **standalone** server (Node 22) with SQLite on a volume. Compose binds **localhost only**.

## Requirements

- Docker Engine 24+ with Compose v2
- About 1 GB disk for the build
- Outbound HTTPS from the container (RSS, CISA KEV, OpenSky, etc.)

## Build and run

On Windows, double-click `build-docker.bat` in the repo root (or run `build-docker.bat --nopause` from cmd). It builds the image and starts the container.

From the repository root on any OS:

```bash
docker compose build
docker compose up -d
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

Equivalent without Compose:

```bash
docker build -t csmon:local .
docker run --rm --name csmon \
  -p 127.0.0.1:3000:3000 \
  -e CSMON_DATA_DIR=/app/data \
  -v csmon-data:/app/data \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  csmon:local
```

The image health check hits `/api/health`. Logs:

```bash
docker compose logs -f csmon
```

Stop:

```bash
docker compose down
```

SQLite survives `down` in the `csmon-data` volume. Wipe it with `docker compose down -v`.

## Rebuild after a git pull

```bash
bash scripts/update.sh docker
```

That rebuilds the image and restarts the service.

## Configuration

Copy `.env.example` to `.env` next to `docker-compose.yml` if you want Compose to load it, or set the same keys under `environment:`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Listen port inside the container |
| `HOSTNAME` | `0.0.0.0` | Bind address inside the container |
| `CSMON_DATA_DIR` | `/app/data` | SQLite directory |
| `CSMON_TOKEN` | unset | Optional shared secret (see `SECURITY.md`) |
| `CSMON_SECURE_COOKIE` | unset | Set `1` behind HTTPS |
| `CSMON_UPDATE_REPO` | `womail/csmon` | GitHub repo for the in-app update check |

The process user is **nextjs** (uid 1001). Capabilities are dropped.

## SBOM in the image

`pnpm generate-sbom` runs during the image build. CycloneDX and SPDX documents are at `/app/sbom/` (and `sbom/` in the git tree after `pnpm generate-sbom` on the host).

```bash
docker compose run --rm csmon cat /app/sbom/cyclonedx.json
```

## Production notes

- Leave the published port on `127.0.0.1`. Put Caddy/nginx/Traefik on the host if you need TLS.
- Set `CSMON_TOKEN` if anything other than loopback can reach the port.
- Do not run this image as a public crawl proxy; scrape/read still egress to the public internet by design.

Troubleshooting: `docker compose ps` and `docker compose logs csmon`. A failing health check usually means the app is still starting or outbound DNS is blocked.
