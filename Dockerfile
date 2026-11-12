FROM remnawave/subscription-page:8.0.1

COPY index.html /opt/app/subpage.template.html
COPY fonts /opt/app/frontend/assets/fonts
RUN node -e "const https=require('https'),fs=require('fs'),fail=m=>{console.error('telegram-web-app.js: '+m);process.exit(1)};https.get('https://telegram.org/js/telegram-web-app.js',r=>{if(r.statusCode!==200)return fail('http '+r.statusCode);let b='';r.setEncoding('utf8');r.on('data',d=>b+=d);r.on('end',()=>{if(b.length<50000||b.indexOf('TelegramWebviewProxy')<0)return fail('unexpected content');fs.writeFileSync('/opt/app/frontend/assets/telegram-web-app.js',b)})}).on('error',e=>fail(e.message))"
COPY randomize.js /opt/app/randomize.js
COPY hwid-enrich.cjs /opt/app/hwid-enrich.cjs
COPY custom-entrypoint.sh /opt/app/custom-entrypoint.sh
RUN chmod +x /opt/app/custom-entrypoint.sh

ENTRYPOINT [ "/bin/sh", "/opt/app/custom-entrypoint.sh" ]
CMD [ "pm2-runtime", "start", "ecosystem.config.js", "--env", "production" ]
