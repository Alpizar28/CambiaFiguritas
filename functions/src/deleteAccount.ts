import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

/**
 * Borrado completo de la cuenta del usuario que invoca (GDPR Art. 17 / Apple guideline 5.1.1).
 *
 * Pasos:
 *  1. Borra subcollections de `users/{uid}/`: private, votes, dailyStats, matchSlots,
 *     entitlements, matchHistory.
 *  2. Borra `users/{uid}` y `userAlbums/{uid}`.
 *  3. Anonimiza `orders/*` donde uid coincide (no se borra para conservar audit financiero,
 *     pero se reemplaza uid → '__deleted__'). Si la política prefiere borrar, cambiar a delete().
 *  4. Borra los votos que el usuario emitió sobre OTROS: collectionGroup('votes')
 *     filtrando por voterUid.
 *  5. Borra eventos cuyo createdBy == uid.
 *  6. Borra la cuenta en Firebase Auth.
 *
 * Reports: NO se borran. Documentado como evidence de moderación, base legal Art. 6(1)(f).
 */
export const requestAccountDeletion = onCall(
  { region: 'us-central1', memory: '512MiB', timeoutSeconds: 300 },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'auth required');

    const db = getFirestore();
    logger.info(`[deleteAccount] start for ${uid}`);

    // 1. Subcollections directas bajo users/{uid}/
    const userSubs = ['private', 'votes', 'dailyStats', 'matchSlots', 'entitlements', 'matchHistory'];
    for (const sub of userSubs) {
      await db.recursiveDelete(db.collection(`users/${uid}/${sub}`));
    }

    // 2. Documentos top-level
    await Promise.all([
      db.doc(`users/${uid}`).delete().catch(() => {}),
      db.doc(`userAlbums/${uid}`).delete().catch(() => {}),
    ]);

    // 3. Orders linked to uid → anonimizar (mantener registro contable sin PII).
    const orders = await db.collection('orders').where('uid', '==', uid).get();
    await Promise.all(
      orders.docs.map((d) =>
        d.ref.update({ uid: '__deleted__', anonymizedAt: new Date() }).catch(() => {}),
      ),
    );

    // 4. Votos que este user emitió sobre otros.
    const castVotes = await db.collectionGroup('votes').where('voterUid', '==', uid).get();
    await Promise.all(castVotes.docs.map((d) => d.ref.delete().catch(() => {})));

    // 5. Eventos creados por este user.
    const events = await db.collection('events').where('createdBy', '==', uid).get();
    await Promise.all(events.docs.map((d) => d.ref.delete().catch(() => {})));

    // 6. Auth account.
    try {
      await getAuth().deleteUser(uid);
    } catch (err) {
      logger.warn(`[deleteAccount] auth delete falló para ${uid}`, err);
    }

    logger.info(
      `[deleteAccount] done for ${uid}: orders=${orders.size} castVotes=${castVotes.size} events=${events.size}`,
    );
    return { ok: true };
  },
);
