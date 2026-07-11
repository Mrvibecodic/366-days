'use strict';
const fs = require('fs');
const crypto = require('crypto');

const src = process.argv[2] || '/opt/app/subpage.template.html';
const dst = process.argv[3] || '/opt/app/frontend/index.html';

const hex = (n) => crypto.randomBytes(n).toString('hex');
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const nm = () => 'a' + hex(ri(2, 4));

try {
  let h = fs.readFileSync(src, 'utf8');
  const nonce = hex(ri(8, 20));

  const seasonal = String(process.env.SUBPAGE_SEASONAL || 'on').toLowerCase();
  if (['off', 'false', '0', 'no', 'disabled'].indexOf(seasonal) >= 0) {
    h = h.replace(/<head>/, '<head>\n    <script>window.__SD="off"</script>');
  }

  const forceMonth = parseInt(process.env.SUBPAGE_FORCE_MONTH || '', 10);
  if (forceMonth >= 1 && forceMonth <= 12) {
    h = h.replace(/<head>/, '<head>\n    <script>window.__SM=' + forceMonth + '</script>');
  }

  h = h.replace(/<html([^>]*)>/, (m, a) => '<html' + a + ' data-' + nm() + '="' + hex(ri(3, 8)) + '">');
  h = h.replace(/<head>/, '<head>\n    <!-- ' + hex(ri(8, 32)) + ' -->\n    <meta name="' + nm() + '" content="' + nonce + '">');

  let vars = '';
  for (let i = 0; i < ri(4, 12); i++) vars += '--_' + hex(3) + ':' + ri(0, 9999) + ';';
  h = h.replace(/:root\s*\{/, (m) => m + vars);

  h = h.replace(/<style>/, '<style>/*' + hex(ri(4, 16)) + '*/');

  const links = h.match(/\n\s*<link rel="(?:apple-touch-icon|icon)[^>]*>/g);
  if (links && links.length > 1) {
    const sh = links.slice().sort(() => Math.random() - 0.5);
    let i = 0;
    h = h.replace(/\n\s*<link rel="(?:apple-touch-icon|icon)[^>]*>/g, () => '\n    ' + sh[i++].trim());
  }

  h = h.replace(/(<div id="ground"[^>]*><\/div>)/, (m) => m + '\n'.repeat(ri(0, 2)));

  fs.writeFileSync(dst, h);
  console.log('[subpage] build ' + nonce + ' (seasonal=' + seasonal + ') -> ' + dst);
} catch (e) {
  console.error('[subpage] randomize failed, using template as-is:', e.message);
  try { fs.copyFileSync(src, dst); } catch (_) {}
}
