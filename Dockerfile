# Custom subscription page on top of the official Remnawave image.
# The official backend still injects panelData and serves /assets/.app-config-v2.json;
# we only replace the frontend index.html with our self-contained page and
# re-randomize it on every container start (anti-fingerprint).
FROM remnawave/subscription-page:latest

# Our page template (keeps the <%= ... %> placeholders the backend fills in)
COPY index.html /opt/app/subpage.template.html

# Self-hosted, browser-cached fonts (served at /assets/fonts/*.woff2)
COPY fonts /opt/app/frontend/assets/fonts

# Startup randomizer + wrapper entrypoint
COPY randomize.js /opt/app/randomize.js
COPY custom-entrypoint.sh /opt/app/custom-entrypoint.sh
RUN chmod +x /opt/app/custom-entrypoint.sh

ENTRYPOINT [ "/bin/sh", "/opt/app/custom-entrypoint.sh" ]
CMD [ "pm2-runtime", "start", "ecosystem.config.js", "--env", "production" ]
