FROM remnawave/subscription-page:latest

COPY index.html /opt/app/subpage.template.html
COPY fonts /opt/app/frontend/assets/fonts
COPY randomize.js /opt/app/randomize.js
COPY hwid-enrich.cjs /opt/app/hwid-enrich.cjs
COPY custom-entrypoint.sh /opt/app/custom-entrypoint.sh
RUN chmod +x /opt/app/custom-entrypoint.sh

ENTRYPOINT [ "/bin/sh", "/opt/app/custom-entrypoint.sh" ]
CMD [ "pm2-runtime", "start", "ecosystem.config.js", "--env", "production" ]
