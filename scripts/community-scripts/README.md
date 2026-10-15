# csmon on Proxmox (Community Scripts)

These files follow the [Community Scripts](https://community-scripts.org/) CT contract: the **wizard on the Proxmox host** creates the LXC, IP, storage, and SSH; the **install script** runs inside the guest.

| File | Role |
| --- | --- |
| `ct/csmon.sh` | Host entry: `start` → `build_container` → `description`; defines `update_script` |
| `install/csmon-install.sh` | Guest: Docker, `git clone`, `docker compose` (+ LAN override) |

## Run on Proxmox VE (from scratch)

On the **hypervisor** as root (same pattern as [Script Generator](https://community-scripts.org/generator) output):

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/womail/csmon/main/scripts/community-scripts/ct/csmon.sh)"
```

The interactive flow asks for container ID, hostname, CPU/RAM/disk, **static IP or DHCP**, bridge, password, and SSH key — then builds Debian 13 LXC with **nesting** (Docker), clones csmon, and publishes **http://&lt;container-ip&gt;:3000**.

## Update

Re-run the CT script and pick **update**, or inside the container:

```bash
update
```

(`update_script` in `ct/csmon.sh` runs `git pull` and `docker compose` rebuild; SQLite stays in the `csmon-data` volume.)

## If install fails and the LXC disappears

Community Scripts **Core removes the container by default** when the in-guest install exits with an error (menu option 1, or **no input for 60 seconds**). That is expected Core behavior, not csmon deleting Proxmox itself.

**Retry** (port fix is on `main` — publish via `CSMON_PUBLISH_IP=0.0.0.0`, no double `:3000` bind):

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/womail/csmon/main/scripts/community-scripts/ct/csmon.sh)"
```

On failure, choose **keep container for debugging** (option 2) or run with:

```bash
dev_mode=keep bash -c "$(curl -fsSL …/ct/csmon.sh)"
```

Then inside the CT: `cd /opt/csmon && git pull && export CSMON_PUBLISH_IP=0.0.0.0 && docker compose up -d --build`.

## Test from a git checkout

```bash
export COMMUNITY_SCRIPTS_ROOT="/path/to/csmon/scripts/community-scripts"
bash scripts/community-scripts/ct/csmon.sh
```

## Submit to Community Scripts

To list csmon on [community-scripts.org](https://community-scripts.org/), open a PR to [community-scripts/ProxmoxVE](https://github.com/community-scripts/ProxmoxVE):

1. Copy `ct/csmon.sh` → `ct/csmon.sh` (set `_CS_DEFAULT_URL` to `https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main`).
2. Copy `install/csmon-install.sh` → `install/csmon-install.sh`.
3. Add metadata via their generator / site docs so the one-liner appears in the catalog.

## Legacy host-only script

`scripts/proxmox-create.sh` is a non-wizard fallback (env file + `pct` only). Prefer this Community Scripts layout for the full “build from scratch” experience.
