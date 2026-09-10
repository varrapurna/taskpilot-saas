#!/usr/bin/env bash

# Run this on the Lightsail server as the ubuntu user:
#   bash scripts/configure-nginx.sh

set -euo pipefail

CONFIG_FILE="/etc/nginx/sites-enabled/taskpilot-api"
BACKUP_DIR="/etc/nginx/taskpilot-backups"
BACKUP_FILE="${BACKUP_DIR}/taskpilot-api.$(date +%Y%m%d%H%M%S)"

echo "Saving a backup to ${BACKUP_FILE}..."
sudo install -d -m 700 "$BACKUP_DIR"
sudo cp -a "$CONFIG_FILE" "$BACKUP_FILE"

echo "Writing TaskPilot routing configuration..."
sudo tee "$CONFIG_FILE" > /dev/null <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name api.taskpilotapp.online;

    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl ipv6only=on;
    server_name api.taskpilotapp.online;

    ssl_certificate /etc/letsencrypt/live/api.taskpilotapp.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.taskpilotapp.online/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 10m;

    # TaskPilot owns only these public API routes. PocketBase's admin UI also
    # calls /api/*, so a broad /api/ proxy to Next.js would break its login.
    location = /api/health {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /api/register {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /api/webhook {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location ^~ /api/auth/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo nginx -t
sudo systemctl reload nginx

echo "Nginx is configured. Check https://api.taskpilotapp.online/api/health"
