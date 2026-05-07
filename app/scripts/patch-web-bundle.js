#!/usr/bin/env node
// Post-export patch para web bundle:
// 1) Reemplaza `import.meta` por `({})` (zustand devtools usa sintaxis Vite que Metro no transforma).
// 2) Renombra el bundle con hash MD5 del contenido patcheado para invalidar CDN cache (Firebase Hosting cachea immutable 1y).
// 3) Actualiza index.html con la nueva ruta.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const distDir = path.resolve(__dirname, '..', 'dist');
const jsDir = path.join(distDir, '_expo', 'static', 'js', 'web');
const htmlPath = path.join(distDir, 'index.html');

if (!fs.existsSync(jsDir)) {
  console.error(`[patch-web-bundle] dist/_expo/static/js/web no existe. Corré expo export primero.`);
  process.exit(1);
}

const files = fs.readdirSync(jsDir).filter((f) => f.endsWith('.js'));

// Si existe web/index.html (template custom con manifest, OG tags, splash), usarlo
// como base e inyectar el script tag del bundle. Expo genera un index.html mínimo
// por default, ignorando web/index.html.
const webDir = path.resolve(__dirname, '..', 'web');
const customTemplate = path.join(webDir, 'index.html');
let html;
if (fs.existsSync(customTemplate)) {
  const template = fs.readFileSync(customTemplate, 'utf8');
  const generated = fs.readFileSync(htmlPath, 'utf8');
  const scriptMatch = generated.match(/<script[^>]+src="[^"]*\/_expo\/static\/js\/web\/[^"]+"[^>]*><\/script>/);
  if (!scriptMatch) {
    console.error('[patch-web-bundle] no se encontró <script> del bundle en index.html generado');
    process.exit(1);
  }
  if (template.includes('</body>')) {
    html = template.replace('</body>', `    ${scriptMatch[0]}\n  </body>`);
  } else {
    console.error('[patch-web-bundle] web/index.html no contiene </body>');
    process.exit(1);
  }
  console.log('[patch-web-bundle] usando web/index.html como template');
} else {
  html = fs.readFileSync(htmlPath, 'utf8');
}

// Pase 1: aplicar import.meta + rehash para bundles principales (con cambios).
// Pase 2: pase posterior reemplaza __SENTRY_RELEASE__ con el hash del bundle index principal,
// para que Sentry runtime sepa qué release está corriendo.
const renamed = []; // tracking de nombres finales para inyectar release
for (const oldName of files) {
  const fullPath = path.join(jsDir, oldName);
  const original = fs.readFileSync(fullPath, 'utf8');
  const patched = original.replace(/import\.meta/g, '({})');
  if (patched === original) {
    console.log(`[patch-web-bundle] ${oldName}: sin cambios`);
    renamed.push(oldName);
    continue;
  }
  const hash = crypto.createHash('md5').update(patched).digest('hex').slice(0, 32);
  const newName = `index-${hash}.js`;
  const newPath = path.join(jsDir, newName);
  fs.writeFileSync(newPath, patched);
  if (newName !== oldName) fs.unlinkSync(fullPath);
  // Si existe sourcemap correspondiente, renombrarlo y actualizar sourceMappingURL del bundle.
  const oldMap = path.join(jsDir, oldName + '.map');
  if (fs.existsSync(oldMap)) {
    const newMap = path.join(jsDir, newName + '.map');
    if (oldMap !== newMap) fs.renameSync(oldMap, newMap);
    // Bundle tiene `//# sourceMappingURL=oldName.map`. Re-escribir referencia y persistir.
    const finalContent = fs
      .readFileSync(newPath, 'utf8')
      .replace(new RegExp(`${oldName}\\.map`, 'g'), `${newName}.map`);
    fs.writeFileSync(newPath, finalContent);
  }
  html = html.split(oldName).join(newName);
  renamed.push(newName);
  console.log(`[patch-web-bundle] ${oldName} -> ${newName} (patched + rehashed)`);
}

// Inyectar Sentry release. El hash del bundle index principal sirve como release id.
const mainBundle = renamed.find((n) => /^index-[a-f0-9]{32}\.js$/.test(n));
if (mainBundle) {
  const release = mainBundle.replace(/^index-/, '').replace(/\.js$/, '');
  for (const fname of renamed) {
    const fpath = path.join(jsDir, fname);
    let content = fs.readFileSync(fpath, 'utf8');
    if (content.includes('__SENTRY_RELEASE__')) {
      content = content.replace(/__SENTRY_RELEASE__/g, release);
      fs.writeFileSync(fpath, content);
      console.log(`[patch-web-bundle] ${fname}: inyectado SENTRY_RELEASE=${release.slice(0, 8)}...`);
    }
  }
}

fs.writeFileSync(htmlPath, html);
console.log('[patch-web-bundle] index.html actualizado.');

// Copiar PWA assets (manifest + sw + favicon icons usables como icon-192/512) a dist root.
const pwaFiles = ['manifest.json', 'ads.txt'];
for (const f of pwaFiles) {
  const src = path.join(webDir, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(distDir, f));
    console.log(`[patch-web-bundle] copiado ${f}`);
  }
}

// Generar sw.js con precache URLs reales (bundle hash final + iconos + manifest).
const swSrc = path.join(webDir, 'sw.js');
if (fs.existsSync(swSrc)) {
  const finalJsFiles = fs.readdirSync(jsDir).filter((f) => f.endsWith('.js'));
  const precacheUrls = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png',
    '/icon-maskable-512.png',
    ...finalJsFiles.map((f) => `/_expo/static/js/web/${f}`),
  ];
  const precacheHash = crypto
    .createHash('md5')
    .update(precacheUrls.join('|'))
    .digest('hex')
    .slice(0, 8);
  const swSource = fs
    .readFileSync(swSrc, 'utf8')
    .replace(/__PRECACHE_URLS__/g, JSON.stringify(precacheUrls))
    .replace(/__PRECACHE_HASH__/g, precacheHash);
  fs.writeFileSync(path.join(distDir, 'sw.js'), swSource);
  console.log(`[patch-web-bundle] sw.js generado con ${precacheUrls.length} URLs precacheadas (hash ${precacheHash})`);
}

// Generar icon-192.png e icon-512.png a partir del icon.png si existen como assets.
// Por ahora, copiar el favicon como fallback. Si no hay íconos PWA, los warnings de Lighthouse aparecen
// pero el manifest sigue siendo válido.
const assetsDir = path.resolve(__dirname, '..', 'assets');
const iconCandidates = [
  { src: 'icon.png', dst: 'icon-512.png' },
  { src: 'icon.png', dst: 'icon-192.png' },
  { src: 'adaptive-icon.png', dst: 'icon-maskable-512.png' },
];
for (const { src, dst } of iconCandidates) {
  const srcPath = path.join(assetsDir, src);
  const dstPath = path.join(distDir, dst);
  if (fs.existsSync(srcPath) && !fs.existsSync(dstPath)) {
    fs.copyFileSync(srcPath, dstPath);
    console.log(`[patch-web-bundle] copiado ${src} -> ${dst}`);
  }
}
