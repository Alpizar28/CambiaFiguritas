#!/usr/bin/env node
/**
 * Migración masiva: borra el campo `email` de todos los docs en `users/`.
 *
 * Por privacidad, ya no guardamos el email en el doc público; solo vive en
 * Firebase Auth. Los usuarios existentes que se loguearon antes del cambio
 * tienen el email guardado: este script los limpia en bulk.
 *
 * USO:
 *   1. Generá una service account key en
 *      https://console.firebase.google.com/project/cambiafiguritas/settings/serviceaccounts/adminsdk
 *      → "Generate new private key" → guardalo como `service-account.json`
 *      en la raíz del repo. NO LO COMMITEÉS.
 *   2. Asegurate de tener `firebase-admin` instalado (npm i -g firebase-admin
 *      o npm i en la raíz). Este script lo carga vía require.
 *   3. Corré: node scripts/cleanup-emails.js
 *   4. Verificá en Firestore que ningún doc en users/ tenga el campo `email`.
 *   5. Borrá `service-account.json` del filesystem cuando termines.
 */
const path = require('path');
const fs = require('fs');

const KEY_PATH = path.resolve(__dirname, '..', 'service-account.json');

if (!fs.existsSync(KEY_PATH)) {
  console.error(`❌ Falta ${KEY_PATH}. Leé el bloque USO al inicio del script.`);
  process.exit(1);
}

let admin;
try {
  admin = require('firebase-admin');
} catch (e) {
  console.error('❌ firebase-admin no está instalado. Corré: npm i firebase-admin');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(KEY_PATH)),
});

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

async function main() {
  const snap = await db.collection('users').get();
  console.log(`📋 ${snap.size} docs en users/`);

  let cleaned = 0;
  let skipped = 0;
  let batch = db.batch();
  let inBatch = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    if ('email' in data) {
      batch.update(doc.ref, { email: FieldValue.delete() });
      inBatch++;
      cleaned++;
      if (inBatch >= 400) {
        await batch.commit();
        console.log(`  ✓ commit (${cleaned} hasta ahora)`);
        batch = db.batch();
        inBatch = 0;
      }
    } else {
      skipped++;
    }
  }

  if (inBatch > 0) {
    await batch.commit();
  }

  console.log(`✅ ${cleaned} docs limpiados, ${skipped} ya estaban OK.`);
  process.exit(0);
}

main().catch((e) => {
  console.error('❌ Error:', e);
  process.exit(1);
});
