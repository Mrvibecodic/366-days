#!/bin/sh
set -e

node /opt/app/randomize.js /opt/app/subpage.template.html /opt/app/frontend/index.html \
  || cp /opt/app/subpage.template.html /opt/app/frontend/index.html

export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--require /opt/app/hwid-enrich.cjs"

exec /bin/sh /opt/app/docker-entrypoint.sh "$@"
