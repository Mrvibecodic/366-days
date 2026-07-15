#!/bin/sh
set -e

node /opt/app/randomize.js /opt/app/subpage.template.html /opt/app/frontend/index.html \
  || cp /opt/app/subpage.template.html /opt/app/frontend/index.html

case "$(printf '%s' "${SUBPAGE_TG_SELFHOST:-off}" | tr '[:upper:]' '[:lower:]')" in
  on|1|true|yes|enabled)
    sed -i 's#https://telegram.org/js/telegram-web-app.js#/assets/telegram-web-app.js#g' /opt/app/frontend/index.html ;;
esac

export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--require /opt/app/hwid-enrich.cjs"

exec /bin/sh /opt/app/docker-entrypoint.sh "$@"
