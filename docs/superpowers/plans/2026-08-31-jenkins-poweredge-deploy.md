# Poweredge Jenkins library deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Jenkinsfile and systemd unit that deploy the Archify library web UI to `/home/veertu/archify` on agent `poweredge` and keep it running.

**Architecture:** Declarative Pipeline on `poweredge` rsyncs the workspace into `/home/veertu/archify` (preserving `var/library`, `var/logs`, `var/run`), installs `deploy/archify-library.service`, restarts systemd, and verifies `GET /api/health` on port 8787.

**Tech Stack:** Jenkins Declarative Pipeline (Groovy), bash/rsync, systemd, Node app via existing `scripts/serve-gallery.sh`.

## Global Constraints

- Agent label: `poweredge`
- Deploy root: `/home/veertu/archify`
- Unit name: `archify-library.service`
- Protect on sync: `var/library/`, `var/logs/`, `var/run/`
- Health URL: `http://127.0.0.1:8787/api/health`
- Do not change library app UI/API code in this plan
- Spec: `docs/superpowers/specs/2026-08-31-jenkins-poweredge-deploy-design.md`

## File map

| File | Responsibility |
|---|---|
| `deploy/archify-library.service` | systemd unit: run `serve-gallery.sh` as `veertu` |
| `Jenkinsfile` | Checkout, rsync deploy, install/restart unit, health verify |

---

### Task 1: systemd unit file

**Files:**
- Create: `deploy/archify-library.service`

**Interfaces:**
- Consumes: `/home/veertu/archify/scripts/serve-gallery.sh` (existing)
- Produces: unit definition installed later by Jenkins to `/etc/systemd/system/archify-library.service`

- [ ] **Step 1: Create `deploy/` and write the unit file**

```ini
[Unit]
Description=Archify library web UI (diagram view and edit)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=veertu
Group=veertu
WorkingDirectory=/home/veertu/archify
Environment=HOME=/home/veertu
Environment=ARCHIFY_GALLERY_HOST=0.0.0.0
Environment=ARCHIFY_GALLERY_PORT=8787
Environment=ARCHIFY_UPDATE_CHECK_DISABLED=1
ExecStart=/home/veertu/archify/scripts/serve-gallery.sh
Restart=on-failure
RestartSec=3
KillMode=process

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 2: Verify file exists and is readable**

Run: `test -f deploy/archify-library.service && grep -q 'ExecStart=/home/veertu/archify/scripts/serve-gallery.sh' deploy/archify-library.service && echo OK`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add deploy/archify-library.service
git commit -m "$(cat <<'EOF'
Add systemd unit for Archify library web UI

EOF
)"
```

---

### Task 2: Jenkinsfile deploy + verify

**Files:**
- Create: `Jenkinsfile`

**Interfaces:**
- Consumes: `deploy/archify-library.service` from Task 1; workspace checkout of `scripts/`, `archify/`, `var/www/`, `var/library/` (seed)
- Produces: running service on poweredge at `/home/veertu/archify` listening on 8787

- [ ] **Step 1: Write `Jenkinsfile`**

```groovy
// Deploy Archify library UI to /home/veertu/archify on poweredge.
// Requires: write access to deploy root; passwordless sudo for systemctl + unit install.
pipeline {
  agent { label 'poweredge' }

  options {
    timestamps()
    disableConcurrentBuilds()
  }

  environment {
    DEPLOY_ROOT = '/home/veertu/archify'
    UNIT_NAME = 'archify-library'
    HEALTH_URL = 'http://127.0.0.1:8787/api/health'
  }

  stages {
    stage('Deploy') {
      steps {
        sh '''
          set -euo pipefail

          mkdir -p "${DEPLOY_ROOT}"

          # First deploy: seed library data if missing on the host.
          if [ ! -d "${DEPLOY_ROOT}/var/library" ] && [ -d "${WORKSPACE}/var/library" ]; then
            mkdir -p "${DEPLOY_ROOT}/var"
            cp -a "${WORKSPACE}/var/library" "${DEPLOY_ROOT}/var/library"
          fi

          mkdir -p "${DEPLOY_ROOT}/var/logs" "${DEPLOY_ROOT}/var/run"

          rsync -a --delete \
            --exclude '.git/' \
            --exclude '.git' \
            --exclude 'var/library/' \
            --exclude 'var/logs/' \
            --exclude 'var/run/' \
            --exclude 'node_modules/' \
            "${WORKSPACE}/" "${DEPLOY_ROOT}/"

          chmod +x "${DEPLOY_ROOT}/scripts/serve-gallery.sh" \
                   "${DEPLOY_ROOT}/scripts/run-preview.sh" || true

          sudo cp "${DEPLOY_ROOT}/deploy/archify-library.service" \
            "/etc/systemd/system/${UNIT_NAME}.service"
          sudo systemctl daemon-reload
          sudo systemctl enable "${UNIT_NAME}.service"
          sudo systemctl restart "${UNIT_NAME}.service"
          sudo systemctl --no-pager --full status "${UNIT_NAME}.service" || true
        '''
      }
    }

    stage('Verify') {
      steps {
        sh '''
          set -euo pipefail
          ok=0
          for i in $(seq 1 15); do
            if curl -fsS "${HEALTH_URL}" | grep -q '"ok"[[:space:]]*:[[:space:]]*true'; then
              echo "health ok on attempt ${i}"
              ok=1
              break
            fi
            echo "health wait ${i}/15"
            sleep 2
          done
          if [ "${ok}" != "1" ]; then
            echo "health check failed"
            sudo journalctl -u "${UNIT_NAME}.service" -n 80 --no-pager || true
            exit 1
          fi
          sudo systemctl is-active "${UNIT_NAME}.service"
        '''
      }
    }
  }
}
```

- [ ] **Step 2: Syntax sanity check locally**

Run: `test -f Jenkinsfile && grep -q "label 'poweredge'" Jenkinsfile && grep -q 'archify-library' Jenkinsfile && grep -q 'var/library' Jenkinsfile && echo OK`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add Jenkinsfile
git commit -m "$(cat <<'EOF'
Add Jenkinsfile to deploy library UI on poweredge

EOF
)"
```

---

### Task 3: Plan self-check against spec (no code)

**Files:** none

- [ ] **Step 1: Confirm coverage**

Map spec requirements to files:

| Spec requirement | Covered by |
|---|---|
| Agent `poweredge` | `Jenkinsfile` agent label |
| Path `/home/veertu/archify` | `DEPLOY_ROOT` + unit WorkingDirectory |
| systemd | `deploy/archify-library.service` + systemctl in Deploy |
| rsync workspace | Deploy stage rsync |
| Keep `var/library` | rsync excludes + first-seed copy |
| Health `/api/health` | Verify stage |
| view/edit UI | Deployed `var/www` + `archify-app-server.mjs` via serve script |

- [ ] **Step 2: No further commit unless gaps found**

---

## Spec coverage self-review

1. Spec coverage: all locked decisions have a task step.
2. Placeholder scan: none.
3. Names consistent: unit `archify-library`, path `/home/veertu/archify`, port 8787.
