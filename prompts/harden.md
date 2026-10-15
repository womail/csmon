# Harden csmon

Tighten the local-operator threat model in `SECURITY.md`. Do not add scanners, exploit payloads, auth bypasses, or multi-user accounts.

## Run first

From the repo root:

```bash
pnpm security:audit
pnpm security:outbound
pnpm security:live
```

`security:audit` reads the tree. `security:outbound` checks `parsePublicHttpUrl` against private, link-local, credential, and odd-port URLs. `security:live` curls loopback only. If nothing is listening it says so and exits. Pass `--require-auth` only when this instance is supposed to have `CSMON_TOKEN` set.

Fix failures. Treat warnings as a decision, not a drive-by refactor.

## Known gaps the scripts warn on

- `GET /api/version` does not call `gate`. Health and session are the only intentional openings. Gate version the same way as `GET /api/state` if this instance should hide the commit hash.
- `lib/update-manifest.ts` fetches the operator manifest with `fetch`, not `fetchOutbound`. `app/api/update/route.ts` fetches GitHub the same way. New outbound calls do not get that exception. If you close the gap, send both through `fetchOutbound` and keep the API check-only.

## Invariants

- Every new route handler calls `gate`, except `/api/health` and `/api/session`.
- Session stays rate-limited and does not require a cookie before the token is checked.
- Cookie flags stay HttpOnly and SameSite=Strict. `Secure` stays behind `CSMON_SECURE_COOKIE=1` in production.
- Redirects stay manual and each hop is re-checked. Body caps stay in `fetchOutbound` and `readLimited`.
- `fail()` keeps returning a fixed sentence. Do not return `error.message` for upstream HTTP failures.
- Compose's default publish address stays `127.0.0.1`. A LAN file may override it on purpose. Do not change the default.
- The image user stays uid 1001. `cap_drop: ALL` and `no-new-privileges` stay on the service.
- Updates stay check-only. No route writes the git tree or restarts the container.

## After a fix

Re-run the three commands. If a route, header, or outbound rule changed, update `SECURITY.md` and the Security section of `csmon.md`.
