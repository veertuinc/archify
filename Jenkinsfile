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
                   "${DEPLOY_ROOT}/scripts/run-preview.sh" \
                   "${DEPLOY_ROOT}/scripts/refresh-library.sh" \
                   "${DEPLOY_ROOT}/scripts/refresh-library.mjs" || true

          # Library HTML artifacts are excluded from rsync; re-deliver them so
          # template/runtime changes (export menu, viewer chrome, etc.) land.
          if [ -f "${DEPLOY_ROOT}/var/library/manifest.json" ]; then
            HOME="${HOME:-/home/veertu}" "${DEPLOY_ROOT}/scripts/refresh-library.sh"
          fi

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
