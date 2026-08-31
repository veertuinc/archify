# Jenkins poweredge deploy: Archify library web UI

Date: 2026-08-31  
Status: approved direction (approach 1); awaiting implementation plan after spec review

## Goal

Add a `Jenkinsfile` that runs on Jenkins agent label `poweredge`, deploys the Archify library web UI (diagram list, view, and edit) to `/home/veertu/archify`, and leaves it running under systemd.

## Decisions already locked

| Topic | Choice |
|---|---|
| Agent | `node('poweredge')` |
| Deploy root | `/home/veertu/archify` |
| Process manager | systemd system unit |
| File sync | rsync Jenkins workspace → deploy root |
| Live data | Keep `var/library/` (and `var/logs/`, `var/run/`) across deploys |
| App entry | Existing `scripts/serve-gallery.sh` → `scripts/archify-app-server.mjs` on port 8787 |
| Success check | `GET http://127.0.0.1:8787/api/health` returns `{ ok: true }` |

## Architecture

Declarative Pipeline on `poweredge`:

1. Checkout the repo into the normal Jenkins workspace.
2. Ensure deploy root exists.
3. Rsync workspace into `/home/veertu/archify` with deletes for refreshed trees, but protect live library/runtime dirs.
4. Install or update `archify-library.service` under `/etc/systemd/system/`.
5. `systemctl daemon-reload`, then `enable --now` / `restart`.
6. Poll health until success or fail the build.

No separate deploy host: the agent node is the runtime host.

## Components

### `Jenkinsfile` (repo root)

- `agent { label 'poweredge' }`
- Stages: `Checkout` (SCM), `Deploy`, `Verify`
- `Deploy` runs shell that:
  - `mkdir -p /home/veertu/archify`
  - `rsync -a --delete` with excludes (see below)
  - copies unit file with `sudo`
  - reloads and restarts systemd
- `Verify` curls `/api/health` with a short retry loop (e.g. 15 attempts, 2s apart)

### `deploy/archify-library.service`

System unit:

- `User=veertu`, `Group=veertu`
- `WorkingDirectory=/home/veertu/archify`
- `ExecStart=/home/veertu/archify/scripts/serve-gallery.sh`
- `Restart=on-failure`
- `Environment` may set `ARCHIFY_GALLERY_HOST=0.0.0.0` and `ARCHIFY_GALLERY_PORT=8787` (script already defaults these)
- Depends on network being available

`serve-gallery.sh` already pins Node via nvm path and sets `ARCHIFY_UPDATE_CHECK_DISABLED=1`.

### Rsync policy

Refresh from workspace:

- `archify/`
- `scripts/` (including app server and `serve-gallery.sh`)
- `var/www/` (library UI: `index.html` view/edit surface, gallery assets)
- `deploy/`
- other tracked project files needed for `archify deliver` (schemas live under `archify/`)

Protect on the host (do not delete / do not overwrite with empty):

- `var/library/`
- `var/logs/`
- `var/run/`

Exclude noise:

- `.git/`
- `.gitignore` optional keep
- Jenkins `@tmp` / workspace junk if present
- `node_modules/` if ever present at root

First deploy: if `var/library` is absent on the host, seed it once from workspace `var/library/` before enabling exclude-on-delete behavior for that path (copy if missing, then protect thereafter).

### Host permissions

The Jenkins agent on `poweredge` must:

1. Write to `/home/veertu/archify` (agent user is `veertu`, or has group/ACL write there).
2. Run passwordless sudo for:
   - `cp` of the unit into `/etc/systemd/system/`
   - `systemctl daemon-reload|enable|restart|is-active|status`

If either is missing, fix it once on the host (sudoers / ownership). Note the assumption in a short Jenkinsfile comment.

## Data flow

```
SCM → Jenkins workspace on poweredge
         ↓ rsync (protect var/library)
 /home/veertu/archify
         ↓ systemd ExecStart
 serve-gallery.sh → archify-app-server.mjs
         ↓
 static UI var/www + API /api/* + deliver via archify/bin
```

Browser hits host:8787 → `index.html` (list/view/edit) → API mutates `var/library`.

## Error handling

- Rsync failure → fail stage (do not restart unit on partial sync).
- systemctl restart failure → fail stage; leave previous unit file only if copy failed before reload (prefer: copy then reload then restart atomically in one stage; if restart fails, build fails and ops inspects `journalctl -u archify-library`).
- Health check timeout → fail `Verify` even if systemd reports active (catch bind/Node path errors).
- Do not wipe `var/library` on failure.

## Out of scope

- HTTPS / reverse proxy
- Multi-node deploy
- Migrating existing diagrams from another host
- Changing the library app UI or API
- npm publish / GitHub Actions changes

## Verification (manual / first pipeline run)

1. Job runs on label `poweredge`.
2. `/home/veertu/archify/scripts/archify-app-server.mjs` and `var/www/index.html` exist.
3. `systemctl is-active archify-library` is `active`.
4. `curl -fsS http://127.0.0.1:8787/api/health` → `{"ok":true}` (or pretty-printed equivalent).
5. Open `/` in a browser: diagram list and edit workspace load.
6. Create or edit a diagram; confirm files under `/home/veertu/archify/var/library` change and survive a second pipeline run.

## Implementation notes for the plan

- Add only `Jenkinsfile` and `deploy/archify-library.service` unless a tiny helper script is required for readable rsync excludes.
- Prefer inline shell in the Jenkinsfile over a second wrapper script unless the stage exceeds ~40 lines.
- Keep STE-friendly comments minimal; no promotional docs beyond this spec.
