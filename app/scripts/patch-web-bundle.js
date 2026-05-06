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
