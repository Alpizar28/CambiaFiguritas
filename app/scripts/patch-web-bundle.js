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
let html = fs.readFileSync(htmlPath, 'utf8');

for (const oldName of files) {
  const fullPath = path.join(jsDir, oldName);
  const original = fs.readFileSync(fullPath, 'utf8');
  const patched = original.replace(/import\.meta/g, '({})');
  if (patched === original) {
    console.log(`[patch-web-bundle] ${oldName}: sin cambios`);
    continue;
  }
  const hash = crypto.createHash('md5').update(patched).digest('hex').slice(0, 32);
  const newName = `index-${hash}.js`;
  const newPath = path.join(jsDir, newName);
  fs.writeFileSync(newPath, patched);
  if (newName !== oldName) fs.unlinkSync(fullPath);
  html = html.split(oldName).join(newName);
  console.log(`[patch-web-bundle] ${oldName} -> ${newName} (patched + rehashed)`);
}

fs.writeFileSync(htmlPath, html);
console.log('[patch-web-bundle] index.html actualizado.');

// Copiar PWA assets (manifest + sw + favicon icons usables como icon-192/512) a dist root.
const webDir = path.resolve(__dirname, '..', 'web');
const pwaFiles = ['manifest.json', 'sw.js'];
for (const f of pwaFiles) {
  const src = path.join(webDir, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(distDir, f));
    console.log(`[patch-web-bundle] copiado ${f}`);
  }
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
