# Docker

csmon runs as a container built on official **Ubuntu Server 24.04** (`docker.io/library/ubuntu:24.04`). Compose pulls that image, installs Node 22, builds the Next.js standalone server, and starts it. SQLite lives on a volume. The published port is **localhost only**.

## Legacy Docker Machine (Docker VM)

You run **docker-machine** against a **Docker VM** (boot2docker-style guest, often on Proxmox/KVM with a fixed LAN IP such as **10.1.1.244**). The Engine you talk to is **inside that VM**, not on your laptop’s `/var/run/docker.sock`.

Every `docker` / `docker compose` command must run **after** pointing the CLI at the machine:

```bash
docker-machine ls
export DOCKER_MACHINE=default          # name from the list
eval "$(docker-machine env "$DOCKER_MACHINE")"
docker info | head -5                  # must succeed; shows the VM’s engine
```

Build csmon **on the Docker VM** (context is uploaded from your checkout):

```bash
cd /path/to/csmon
docker pull ubuntu:24.04
docker build --pull -t csmon:local .
docker rm -f csmon 2>/dev/null || true
docker run -d --name csmon \
  -p 3000:3000 \
  -e CSMON_DATA_DIR=/app/data \
  -v csmon-data:/app/data \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  csmon:local
```

Or with Compose (LAN port override so the service is not VM-localhost-only):

```bash
eval "$(docker-machine env "$DOCKER_MACHINE")"
docker compose -f docker-compose.yml -f docker-compose.lan.yml pull ubuntu
docker compose -f docker-compose.yml -f docker-compose.lan.yml build --pull
docker compose -f docker-compose.yml -f docker-compose.lan.yml up -d
```

**URL from your PC:** use the machine’s IP (static on Proxmox or from `docker-machine ip`):

```bash
docker-machine ip "$DOCKER_MACHINE"    # e.g. 10.1.1.244
# open http://10.1.1.244:3000
curl -sS "http://$(docker-machine ip "$DOCKER_MACHINE"):3000/api/health"
```

Use **`-p 3000:3000`** when you want the LAN IP above. The repo’s default `-p 127.0.0.1:3000:3000` only listens on the **VM’s** loopback; your laptop would need a tunnel:

```bash
docker-machine ssh "$DOCKER_MACHINE" -N -L 3000:127.0.0.1:3000
# then http://127.0.0.1:3000 on the laptop
```

Checks on the VM:

```bash
docker-machine ssh "$DOCKER_MACHINE" docker logs -f csmon
docker-machine ssh "$DOCKER_MACHINE" curl -sS http://127.0.0.1:3000/api/health
```

Stop using the remote engine: `eval "$(docker-machine env -u)"` or a fresh shell.

**Proxmox note:** if the guest is already at **10.1.1.244**, the machine was often created with the **generic** driver (`--generic-ip-address=10.1.1.244`, SSH user/key). The flow is still `eval "$(docker-machine env …)"` then build — same as VirtualBox/VMware drivers, only the driver name differs.

**Not docker-machine:** if you SSH straight into 10.1.1.244 and run `docker` there with no `DOCKER_HOST` from `docker-machine env`, use the section below instead.

## Proxmox VM (Docker Engine without docker-machine)

Plain Docker Engine on a Proxmox guest at **10.1.1.244** (no legacy docker-machine). Build on that host; open [http://10.1.1.244:3000](http://10.1.1.244:3000).

### A — Build on the VM (simplest)

SSH in, install Docker if needed, copy or clone the repo, then build there:

```bash
ssh YOU@10.1.1.244
git clone https://github.com/womail/csmon.git   # or rsync/scp your checkout
cd csmon
docker pull ubuntu:24.04
docker build --pull -t csmon:local .
docker rm -f csmon 2>/dev/null || true
docker run -d --name csmon \
  -p 3000:3000 \
  -e CSMON_DATA_DIR=/app/data \
  -v csmon-data:/app/data \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  csmon:local
curl -sS http://127.0.0.1:3000/api/health
```

Use `-p 3000:3000` (not `127.0.0.1:3000`) so port 3000 is reachable on **10.1.1.244**. Restrict access with Proxmox/firewall or put a reverse proxy in front; set `CSMON_TOKEN` if the LAN is not fully trusted (see `SECURITY.md`).

### B — Build from your laptop via Docker context (SSH)

No `docker-machine` required — Docker 20+ can talk to a remote engine over SSH:

```bash
docker context create csmon-proxmox --docker "host=ssh://YOU@10.1.1.244"
docker context use csmon-proxmox
docker info | head -5

cd /path/to/csmon
docker pull ubuntu:24.04
docker build --pull -t csmon:local .
docker rm -f csmon 2>/dev/null || true
docker run -d --name csmon \
  -p 3000:3000 \
  -e CSMON_DATA_DIR=/app/data \
  -v csmon-data:/app/data \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  csmon:local
```

Switch back to local Docker: `docker context use default`.

Compose on the remote host (after `docker context use csmon-proxmox`):

```bash
docker compose -f docker-compose.yml -f docker-compose.lan.yml build --pull
docker compose -f docker-compose.yml -f docker-compose.lan.yml up -d
```

### Checks

| Where | Command |
| --- | --- |
| On the VM | `curl -sS http://127.0.0.1:3000/api/health` |
| From your PC | `curl -sS http://10.1.1.244:3000/api/health` |
| Logs | `ssh YOU@10.1.1.244 docker logs -f csmon` |

First build can take several minutes (Node install + `pnpm build` inside the image).

## Move a built image to the Docker host

If **`csmon:local` already runs on your PC** and you want the same image on the remote engine (Proxmox / docker-machine VM at e.g. **10.1.1.244**), either **rebuild on the host** (best for updates) or **copy the image** (fast one-off).

### Option 1 — Rebuild on the host (recommended)

Same Dockerfile; no image transfer. Sync source, then build where the container will run:

```bash
rsync -av --exclude node_modules --exclude .next ./ YOU@10.1.1.244:~/csmon/
# or: git push && ssh YOU@10.1.1.244 'cd csmon && git pull'

ssh YOU@10.1.1.244 'cd ~/csmon && docker build --pull -t csmon:local .'
```

With **docker-machine** (build from laptop, engine on VM):

```bash
eval "$(docker-machine env "$DOCKER_MACHINE")"
cd /path/to/csmon
docker build --pull -t csmon:local .
```

That never uses your laptop’s local socket — the image lands on the VM automatically.

### Option 2 — Export / import (`docker save` / `docker load`)

On the machine that **has** the image (local Docker):

```bash
docker save csmon:local | gzip | ssh YOU@10.1.1.244 'gunzip | docker load'
```

Or via **docker-machine**:

```bash
docker save csmon:local | docker-machine ssh "$DOCKER_MACHINE" docker load
```

Large upload (hundreds of MB); ensure disk space on the VM.

### Start the container on the host

After the image exists **on the remote engine** (either option):

```bash
# SSH
ssh YOU@10.1.1.244 'docker rm -f csmon 2>/dev/null; docker run -d --name csmon \
  -p 3000:3000 -e CSMON_DATA_DIR=/app/data -v csmon-data:/app/data \
  --cap-drop ALL --security-opt no-new-privileges:true csmon:local'

# docker-machine from laptop
eval "$(docker-machine env "$DOCKER_MACHINE")"
docker rm -f csmon 2>/dev/null || true
docker run -d --name csmon -p 3000:3000 -e CSMON_DATA_DIR=/app/data \
  -v csmon-data:/app/data --cap-drop ALL --security-opt no-new-privileges:true csmon:local
```

App: `http://10.1.1.244:3000` (or `http://$(docker-machine ip "$DOCKER_MACHINE"):3000`).

**Note:** SQLite lives in the `csmon-data` volume on the **host where you run** the container. Moving the image does not move existing local volume data; copy the volume separately only if you need the same DB.

## Requirements

- Docker Engine 24+ with Compose v2
- About 1 GB disk for the first build
- Outbound HTTPS from the container (RSS, CISA KEV, OpenSky, Node tarball during build)

## Deploy

Compose lists official **Ubuntu Server 24.04** as the `ubuntu` service (`docker.io/library/ubuntu:24.04`). `docker compose pull` fetches that image; `csmon` is then built on it.

```bash
bash scripts/build-docker.sh
```

Or by hand:

```bash
docker compose pull ubuntu
docker compose build --pull
docker compose up -d
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

Equivalent without Compose:

```bash
docker pull ubuntu:24.04
docker build --pull -t csmon:local .
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

That pulls a fresh Ubuntu base, rebuilds, and restarts.

## Configuration

Copy `.env.example` to `.env` next to `docker-compose.yml` if you want Compose to load it, or set the same keys under `environment:`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Listen port inside the container |
| `CSMON_BIND_HOST` | `0.0.0.0` | Bind address for Next.js (entrypoint sets `HOSTNAME` from this). Do **not** set `HOSTNAME` to a LAN IP like `10.1.3.130` — the app cannot listen on the host address inside the container. |
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

### Refresh spins but nothing changes

1. **No layers enabled** — Refresh only hits **enabled** sources. On Home use **Load world RSS** / **Load security RSS**, or enable layers under **Sources**, then Refresh again. The UI now shows an error if nothing is enabled.
2. **`CSMON_TOKEN`** — If set, unlock the board (token gate) so API calls include your token. Failed refresh shows **Token required** in the header error strip.
3. **Outbound network** — Feeds are fetched from inside the container. From the host: `docker compose logs csmon 2>&1 | tail -50` and look for `refresh rss:…` errors. Test DNS/HTTPS: `docker compose exec csmon node -e "fetch('https://www.cisa.gov').then(r=>console.log(r.status)).catch(e=>console.error(e))"`.
4. **SQLite volume permissions** — The app runs as **uid 1001** (`user: "1001:1001"` in Compose). The entrypoint does **not** `chown` the volume (that fails on many hosts and conflicts with `cap_drop: ALL`). **Fix on the Docker host** (once):

   ```bash
   # Named volume (Compose project csmon → volume csmon_csmon-data)
   MP="$(docker volume inspect csmon_csmon-data -f '{{ .Mountpoint }}')"
   chown -R 1001:1001 "$MP"

   # Bind mount instead of a volume, e.g. -v /opt/csmon-data:/app/data
   chown -R 1001:1001 /opt/csmon-data
   ```

   Then recreate: `docker compose up -d --force-recreate csmon`. If SQLite still fails with `EACCES`, confirm `ls -la` on that directory shows owner **1001**.

5. **`runuser: cannot set groups`** — Compose drops all capabilities; do not use `runuser` in a custom entrypoint. Run as `user: "1001:1001"` and start `node server.js` directly (see `docker-compose.fix.yml` pattern below, or rebuild a current image).

6. **`listen EADDRNOTAVAIL` / `10.x.x.x:3000`** — Something set **`HOSTNAME`** to a host LAN IP. Inside the container, bind **`0.0.0.0`** only; publish with Compose `ports:` (`docker-compose.lan.yml`). Remove `HOSTNAME=…` from a host `.env` if present. Current images use **`CSMON_BIND_HOST=0.0.0.0`** in the entrypoint.

7. **Rebuild** — After pulling fixes, rebuild and recreate the container (image transfer alone is not enough if you only `docker load` an old image).
