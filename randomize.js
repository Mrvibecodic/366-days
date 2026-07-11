'use strict';
const fs = require('fs');
const crypto = require('crypto');

const src = process.argv[2] || '/opt/app/subpage.template.html';
const dst = process.argv[3] || '/opt/app/frontend/index.html';

const hex = (n) => crypto.randomBytes(n).toString('hex');
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const nm = () => 'a' + hex(ri(2, 4));

function dynamicPrefixes(html) {
  const pre = new Set();
  let m;
  const r1 = /([A-Za-z_][A-Za-z0-9_]*(?:-{1,2}[A-Za-z0-9_]*)*[-_])\$\{/g;
  while ((m = r1.exec(html))) pre.add(m[1]);
  const r2 = /["'`]([A-Za-z_][A-Za-z0-9_]*(?:-{1,2}[A-Za-z0-9_]*)*[-_])["'`]?\s*\+/g;
  while ((m = r2.exec(html))) pre.add(m[1]);
  return [...pre];
}

function obfuscateClasses(html) {
  try {
    let styles = '';
    const sre = /<style[^>]*>([\s\S]*?)<\/style>/g;
    let m;
    while ((m = sre.exec(html))) styles += '\n' + m[1];
    const found = new Set();
    const cre = /\.(-?[A-Za-z_][A-Za-z0-9_-]*)/g;
    while ((m = cre.exec(styles))) found.add(m[1]);

    const dynPre = dynamicPrefixes(html);
    const isDynamic = (c) => dynPre.some((p) => c !== p && c.startsWith(p));
    const rename = [...found].filter(
      (c) => (/-/.test(c) || /__/.test(c)) && !/^season-/.test(c) && !isDynamic(c)
    );

    const used = new Set(found);
    const map = {};
    for (const c of rename) {
      let nn;
      do { nn = '_' + hex(3).slice(0, 5); } while (used.has(nn) || nn.length < 6);
      used.add(nn);
      map[c] = nn;
    }

    let out = html;
    for (const oldC in map) {
      const esc = oldC.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
      const re = new RegExp('(?<![A-Za-z0-9_-])' + esc + '(?![A-Za-z0-9_-])', 'g');
      out = out.replace(re, map[oldC]);
    }
    return { html: out, count: Object.keys(map).length };
  } catch (e) {
    console.error('[subpage] class obfuscation skipped:', e.message);
    return { html: html, count: 0 };
  }
}

try {
  let h = fs.readFileSync(src, 'utf8');
  const nonce = hex(ri(8, 20));

  const obf = obfuscateClasses(h);
  h = obf.html;

  const seasonal = String(process.env.SUBPAGE_SEASONAL || 'on').toLowerCase();
  if (['off', 'false', '0', 'no', 'disabled'].indexOf(seasonal) >= 0) {
    h = h.replace(/<head>/, '<head>\n    <script>window.__SD="off"</script>');
  }

  const forceMonth = parseInt(process.env.SUBPAGE_FORCE_MONTH || '', 10);
  if (forceMonth >= 1 && forceMonth <= 12) {
    h = h.replace(/<head>/, '<head>\n    <script>window.__SM=' + forceMonth + '</script>');
  }

  h = h.replace(/<html([^>]*)>/, (m, a) => '<html' + a + ' data-' + nm() + '="' + hex(ri(3, 8)) + '">');
  h = h.replace(/<head>/, '<head>\n    <meta name="' + nm() + '" content="' + nonce + '">');

  let vars = '';
  for (let i = 0; i < ri(4, 12); i++) vars += '--_' + hex(3) + ':' + ri(0, 9999) + ';';
  h = h.replace(/:root\s*\{/, (m) => m + vars);

  const links = h.match(/\n\s*<link rel="(?:apple-touch-icon|icon)[^>]*>/g);
  if (links && links.length > 1) {
    const sh = links.slice().sort(() => Math.random() - 0.5);
    let i = 0;
    h = h.replace(/\n\s*<link rel="(?:apple-touch-icon|icon)[^>]*>/g, () => '\n    ' + sh[i++].trim());
  }

  h = h.replace(/(<div id="ground"[^>]*><\/div>)/, (m) => m + '\n'.repeat(ri(0, 2)));

  fs.writeFileSync(dst, h);
  console.log('[subpage] build ' + nonce + ' (seasonal=' + seasonal + ', classes=' + obf.count + ') -> ' + dst);
} catch (e) {
  console.error('[subpage] randomize failed, using template as-is:', e.message);
  try { fs.copyFileSync(src, dst); } catch (_) {}
}
