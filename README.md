# csmon

Scrape public users for sources, filter them into layers, and watch a dense situation board.

## Local (pnpm)

Requires [pnpm 12.5.1](https://pnpm.io) (`packageManager` in `package.json`).

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. Paste a Bluesky handle (`nytimes.com`), profile URL, RSS feed, or website. csmon harvests follows, mentions, and linked sites; you choose which become layers.

```bash
pnpm build && pnpm start
```

## Docker

Deploys on official **Ubuntu Server 24.04** (`ubuntu` in `docker-compose.yml`).

```bash
bash scripts/build-docker.sh
```

```bash
docker compose pull ubuntu
docker compose build --pull
docker compose up -d
```

Open http://127.0.0.1:3000. Full steps, env vars, and volume notes: [DOCKER.md](DOCKER.md).

## Security, SBOM, updates

- [SECURITY.md](SECURITY.md) — SSRF controls, headers, optional token, reporting
- `pnpm generate-sbom` — CycloneDX 1.6 + SPDX at `sbom/`
- Options → **Check now**, or `bash scripts/update.sh` / `scripts/update.sh docker`

Architecture and SQLite schema: [csmon.md](csmon.md). Copy `.env.example` to `.env.local` when you need `CSMON_TOKEN` or a custom data directory.
