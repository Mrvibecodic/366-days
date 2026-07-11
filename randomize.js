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

function maskJs(src) {
  const out = src.split('');
  let i = 0;
  const n = src.length;
  let prevSig = '';
  const isRegexCtx = () => prevSig === '' || '(,=:[!&|?{};+-*%^~<>'.includes(prevSig);
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') { out[i] = ' '; i++; } continue; }
    if (c === '/' && src[i + 1] === '*') { out[i] = ' '; out[i + 1] = ' '; i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] !== '\n') out[i] = ' '; i++; } if (i < n) { out[i] = ' '; out[i + 1] = ' '; i += 2; } continue; }
    if (c === '"' || c === "'") { const q = c; out[i] = ' '; i++; while (i < n && src[i] !== q) { if (src[i] === '\\') { out[i] = ' '; out[i + 1] = ' '; i += 2; continue; } if (src[i] !== '\n') out[i] = ' '; i++; } if (i < n) { out[i] = ' '; i++; } prevSig = 'x'; continue; }
    if (c === '`') {
      out[i] = ' '; i++;
      while (i < n) {
        if (src[i] === '\\') { out[i] = ' '; out[i + 1] = ' '; i += 2; continue; }
        if (src[i] === '`') { out[i] = ' '; i++; break; }
        if (src[i] === '$' && src[i + 1] === '{') {
          out[i] = ' '; i++; let depth = 1; i++;
          while (i < n && depth > 0) {
            const cc = src[i];
            if (cc === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') { out[i] = ' '; i++; } continue; }
            if (cc === '/' && src[i + 1] === '*') { out[i] = ' '; out[i + 1] = ' '; i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] !== '\n') out[i] = ' '; i++; } if (i < n) { out[i] = ' '; out[i + 1] = ' '; i += 2; } continue; }
            if (cc === '"' || cc === "'") { const q = cc; out[i] = ' '; i++; while (i < n && src[i] !== q) { if (src[i] === '\\') { out[i] = ' '; out[i + 1] = ' '; i += 2; continue; } if (src[i] !== '\n') out[i] = ' '; i++; } if (i < n) { out[i] = ' '; i++; } continue; }
            if (cc === '`') { out[i] = ' '; i++; let td = 0; while (i < n) { if (src[i] === '\\') { out[i] = ' '; out[i + 1] = ' '; i += 2; continue; } if (src[i] === '$' && src[i + 1] === '{') { td++; out[i] = ' '; out[i + 1] = ' '; i += 2; continue; } if (src[i] === '}' && td > 0) { td--; out[i] = ' '; i++; continue; } if (src[i] === '`' && td === 0) { out[i] = ' '; i++; break; } if (src[i] !== '\n') out[i] = ' '; i++; } continue; }
            if (cc === '{') depth++; else if (cc === '}') depth--;
            i++;
          }
          continue;
        }
        if (src[i] !== '\n') out[i] = ' ';
        i++;
      }
      prevSig = 'x'; continue;
    }
    if (c === '/' && isRegexCtx()) {
      out[i] = ' '; i++; let inClass = false;
      while (i < n) { if (src[i] === '\\') { out[i] = ' '; out[i + 1] = ' '; i += 2; continue; } if (src[i] === '[') inClass = true; else if (src[i] === ']') inClass = false; else if (src[i] === '/' && !inClass) { out[i] = ' '; i++; break; } if (src[i] !== '\n') out[i] = ' '; i++; }
      while (i < n && /[a-z]/.test(src[i])) { out[i] = ' '; i++; }
      prevSig = 'x'; continue;
    }
    if (!/\s/.test(c)) prevSig = c;
    i++;
  }
  return out.join('');
}

function mangleGlobals(html) {
  try {
    const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
    let m; const blocks = [];
    while ((m = re.exec(html))) blocks.push({ body: m[2] });
    let engIdx = -1;
    blocks.forEach((b, i) => { if (/classList/.test(b.body) && /detectOS/.test(b.body)) engIdx = i; });
    if (engIdx < 0) return { html: html, count: 0 };
    const engine = blocks[engIdx].body;
    const others = blocks.filter((b, i) => i !== engIdx).map((b) => b.body).join('\n');

    const masked = maskJs(engine);
    const depth = new Array(masked.length);
    let d = 0;
    for (let i = 0; i < masked.length; i++) { const c = masked[i]; if (c === '{') d++; else if (c === '}') d--; depth[i] = d; }

    const fnRe = /\bfunction\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
    let fm; const defs = {};
    while ((fm = fnRe.exec(masked))) { const name = fm[1]; (defs[name] = defs[name] || []).push(depth[fm.index]); }

    const builtins = new Set(['document', 'window', 'localStorage', 'Math', 'JSON', 'Date', 'fetch', 'atob', 'btoa', 'console', 'Object', 'Array', 'setTimeout', 'requestAnimationFrame', 'matchMedia', 'URL', 'encodeURIComponent', 'decodeURIComponent', 'setInterval', 'clearTimeout', 'clearInterval', 'navigator', 'location', 'history', 'Promise', 'String', 'Number', 'Boolean', 'RegExp', 'Map', 'Set', 'parseInt', 'parseFloat', 'isNaN', 'Error', 'Function', 'Symbol', 'WeakMap', 'getComputedStyle', 'CSS']);
    const tokenCount = (str, name) => (str.match(new RegExp('(?<![A-Za-z0-9_$])' + name + '(?![A-Za-z0-9_$])', 'g')) || []).length;

    const candidates = [];
    for (const name in defs) {
      const deps = defs[name];
      if (name.indexOf('__') === 0) continue;
      if (name.length <= 3) continue;
      if (builtins.has(name)) continue;
      if (deps.length !== 1 || deps[0] !== 0) continue;
      if (tokenCount(others, name) > 0) continue;
      let nonWindowDot = false; const dotRe = new RegExp('([A-Za-z0-9_$]*)\\s*\\.\\s*' + name + '(?![A-Za-z0-9_$])', 'g'); let dm;
      while ((dm = dotRe.exec(masked))) { if (dm[1] !== 'window') { nonWindowDot = true; break; } }
      if (nonWindowDot) continue;
      if (new RegExp('[\\{,]\\s*' + name + '\\s*:').test(masked)) continue;
      candidates.push(name);
    }

    const used = new Set();
    let mm; const idRe = /_[0-9a-f]{5,7}/g;
    while ((mm = idRe.exec(html))) used.add(mm[0]);
    const map = {};
    for (const name of candidates) {
      let nn; do { nn = '_' + hex(3); } while (used.has(nn));
      used.add(nn); map[name] = nn;
    }

    let out = html;
    for (const oldN in map) {
      const reN = new RegExp('(?<![A-Za-z0-9_$])' + oldN + '(?![A-Za-z0-9_$])', 'g');
      out = out.replace(reN, map[oldN]);
    }
    return { html: out, count: Object.keys(map).length };
  } catch (e) {
    console.error('[subpage] global mangling skipped:', e.message);
    return { html: html, count: 0 };
  }
}

try {
  let h = fs.readFileSync(src, 'utf8');
  const nonce = hex(ri(8, 20));

  const obf = obfuscateClasses(h);
  h = obf.html;

  const mg = mangleGlobals(h);
  h = mg.html;

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
  console.log('[subpage] build ' + nonce + ' (seasonal=' + seasonal + ', classes=' + obf.count + ', globals=' + mg.count + ') -> ' + dst);
} catch (e) {
  console.error('[subpage] randomize failed, using template as-is:', e.message);
  try { fs.copyFileSync(src, dst); } catch (_) {}
}
