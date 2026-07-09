#!/bin/sh
set -e

# Regenerate a per-deployment unique index.html (anti-fingerprint), then hand
# off to the official Remnawave subscription-page entrypoint + command.
node /opt/app/randomize.js /opt/app/subpage.template.html /opt/app/frontend/index.html \
  || cp /opt/app/subpage.template.html /opt/app/frontend/index.html

exec /bin/sh /opt/app/docker-entrypoint.sh "$@"
