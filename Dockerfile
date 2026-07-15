FROM remnawave/subscription-page:latest

COPY index.html /opt/app/subpage.template.html
COPY fonts /opt/app/frontend/assets/fonts
RUN node -e "const https=require('https'),fs=require('fs'),f=fs.createWriteStream('/opt/app/frontend/assets/telegram-web-app.js');https.get('https://telegram.org/js/telegram-web-app.js',r=>{if(r.statusCode!==200){process.exit(0)}r.pipe(f);f.on('finish',()=>process.exit(0))}).on('error',()=>process.exit(0))" || true
COPY randomize.js /opt/app/randomize.js
COPY hwid-enrich.cjs /opt/app/hwid-enrich.cjs
COPY custom-entrypoint.sh /opt/app/custom-entrypoint.sh
RUN chmod +x /opt/app/custom-entrypoint.sh

ENTRYPOINT [ "/bin/sh", "/opt/app/custom-entrypoint.sh" ]
CMD [ "pm2-runtime", "start", "ecosystem.config.js", "--env", "production" ]
