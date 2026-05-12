/**
 * One-shot migration: move `users/{uid}.fcmToken` (legacy path) to
 * `users/{uid}/private/notifications.fcmToken` (new path) for every existing user.
 *
 * Background: F-DB-001 in the 2026-05-12 security audit identified that fcmToken
 * was readable by any signed-in user via the open `users/*` read rule. The new
 * path is owner-only.
 *
 * Steps to run (do this AFTER deploying functions + rules + hosting):
 *
 *   cd functions
 *   npm install firebase-admin   # if not already
 *   # Auth via service-account JSON or `firebase login` + ADC:
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *   npx ts-node scripts/migrate-fcm-tokens.ts --dry-run   # preview
 *   npx ts-node scripts/migrate-fcm-tokens.ts             # apply
 *
 * The script:
 *  1. Scans every `users/*` doc with a top-level `fcmToken` field.
 *  2. For each, sets `users/{uid}/private/notifications.fcmToken` (merging — won't
 *     overwrite a newer token written by the updated client).
 *  3. Deletes the legacy field on the main doc.
 *
 * Idempotent: re-running is safe — the source field is gone after a successful pass.
 *
 * Reversibility: keep a JSON dump of the legacy state before the destructive step.
 * The script writes `migration-backup-<timestamp>.json` automatically.
 */
import { writeFileSync } from 'node:fs';
import * as admin from 'firebase-admin';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const DRY_RUN = process.argv.includes('--dry-run');
const PAGE_SIZE = 500;

type LegacyUser = { uid: string; fcmToken: string };

async function findLegacy(): Promise<LegacyUser[]> {
  const out: LegacyUser[] = [];
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  while (true) {
    let q = db
      .collection('users')
      .where('fcmToken', '!=', null)
      .orderBy('fcmToken')
      .limit(PAGE_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      const token = (doc.data() as { fcmToken?: string }).fcmToken;
      if (token) out.push({ uid: doc.id, fcmToken: token });
    }
    if (snap.size < PAGE_SIZE) break;
    lastDoc = snap.docs[snap.docs.length - 1];
  }
  return out;
}

async function migrate(legacy: LegacyUser[]): Promise<{ moved: number; skipped: number }> {
  let moved = 0;
  let skipped = 0;
  // Process in batches of ~250 (Firestore limit is 500 writes per commit; each
  // user needs 2 writes so 250 users → 500 writes).
  const BATCH = 250;
  for (let i = 0; i < legacy.length; i += BATCH) {
    const slice = legacy.slice(i, i + BATCH);
    const batch = db.batch();
    for (const { uid, fcmToken } of slice) {
      const privRef = db.doc(`users/${uid}/private/notifications`);
      const mainRef = db.doc(`users/${uid}`);
      // Pre-check: don't clobber a newer token already at the new path.
      const privSnap = await privRef.get();
      const existing = (privSnap.data() as { fcmToken?: string } | undefined)?.fcmToken;
      if (existing && existing !== fcmToken) {
        skipped += 1;
        continue;
      }
      batch.set(
        privRef,
        { fcmToken, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true },
      );
      batch.update(mainRef, { fcmToken: admin.firestore.FieldValue.delete() });
      moved += 1;
    }
    if (!DRY_RUN) await batch.commit();
  }
  return { moved, skipped };
}

async function main() {
  console.log(`[migrate-fcm-tokens] dryRun=${DRY_RUN}`);
  const legacy = await findLegacy();
  console.log(`[migrate-fcm-tokens] legacy users with fcmToken in main doc: ${legacy.length}`);
  if (legacy.length === 0) {
    console.log('[migrate-fcm-tokens] nothing to migrate.');
    return;
  }
  // Backup before destructive writes.
  const backupPath = `migration-backup-${Date.now()}.json`;
  writeFileSync(backupPath, JSON.stringify(legacy, null, 2));
  console.log(`[migrate-fcm-tokens] wrote backup: ${backupPath}`);
  const { moved, skipped } = await migrate(legacy);
  console.log(`[migrate-fcm-tokens] moved=${moved} skipped=${skipped} dry=${DRY_RUN}`);
}

main().catch((err) => {
  console.error('[migrate-fcm-tokens] FATAL', err);
  process.exit(1);
});
