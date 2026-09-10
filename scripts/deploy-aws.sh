#!/usr/bin/env bash

# Run this on the Lightsail server as the ubuntu user:
#   bash scripts/deploy-aws.sh
#
# Production deployments use the main branch. The source and PocketBase
# migrations live in GitHub; live PocketBase data remains in
# /home/ubuntu/pocketbase.

set -euo pipefail

APP_DIR="/opt/taskpilot/taskpilot-saas"
PB_DIR="/home/ubuntu/pocketbase"
PB_MIGRATIONS_DIR="$APP_DIR/database/pocketbase/migrations"
BRANCH="main"

cd "$APP_DIR"

echo "Updating TaskPilot source..."
GIT_SSH_COMMAND="ssh -i /home/ubuntu/.ssh/taskpilot -o IdentitiesOnly=yes" \
  git fetch origin "$BRANCH"

if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git checkout "$BRANCH"
else
  git checkout --track -b "$BRANCH" "origin/$BRANCH"
fi

GIT_SSH_COMMAND="ssh -i /home/ubuntu/.ssh/taskpilot -o IdentitiesOnly=yes" \
  git pull --ff-only origin "$BRANCH"

echo "Installing locked dependencies..."
npm ci

echo "Building TaskPilot API..."
npm run build

echo "Installing the TaskPilot service definition..."
sudo install -D -m 644 \
  "$APP_DIR/infrastructure/systemd/taskpilot-api.service" \
  /etc/systemd/system/taskpilot-api.service

echo "Syncing PocketBase migrations..."
sudo install -d -m 755 "$PB_DIR/pb_migrations"
sudo cp -a "$PB_MIGRATIONS_DIR/." "$PB_DIR/pb_migrations/"

echo "Restarting services..."
sudo systemctl daemon-reload
sudo systemctl restart pocketbase
sudo systemctl enable --now taskpilot-api

echo "Deployment complete. Check https://api.taskpilotapp.online/api/health"
