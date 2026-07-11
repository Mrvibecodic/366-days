#!/bin/sh
set -e

# Regenerate a per-deployment unique index.html (anti-fingerprint), then hand
# off to the official Remnawave subscription-page entrypoint + command.
node /opt/app/randomize.js /opt/app/subpage.template.html /opt/app/frontend/index.html \
  || cp /opt/app/subpage.template.html /opt/app/frontend/index.html

# Enable per-user HWID device enrichment (skipped at runtime unless HWID_DEVICES=on)
export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--require /opt/app/hwid-enrich.cjs"

exec /bin/sh /opt/app/docker-entrypoint.sh "$@"
