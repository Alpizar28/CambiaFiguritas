import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

type Vote = 'up' | 'down';

type Payload = {
  targetUid: string;
  vote: Vote;
};

/**
 * Callable atómica para registrar voto reputación.
 * Garantías:
 * - Auth requerida
 * - No self-vote
 * - Idempotente (un voter, un voto activo por target). Cambio de voto ajusta contadores.
 * - Increment atómico vía FieldValue.increment dentro de transaction.
 */
export const recordReputationVote = onCall<Payload>(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Necesitás iniciar sesión.');
    }
    const voterUid = request.auth.uid;
    const { targetUid, vote } = request.data ?? ({} as Payload);
    if (!targetUid || (vote !== 'up' && vote !== 'down')) {
      throw new HttpsError('invalid-argument', 'Payload inválido.');
    }
    if (targetUid === voterUid) {
      throw new HttpsError('failed-precondition', 'No podés votarte a vos mismo.');
    }

    const db = getFirestore();
    const userRef = db.doc(`users/${targetUid}`);
    const voteRef = db.doc(`users/${targetUid}/votes/${voterUid}`);

    return await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) {
        throw new HttpsError('not-found', 'Usuario destino no existe.');
      }
      const existingVote = await tx.get(voteRef);

      if (existingVote.exists) {
        const prev = existingVote.data() as { vote: Vote };
        if (prev.vote === vote) {
          return { ok: true, wasNew: false, reason: 'duplicate' };
        }
        // Cambio de voto
        const upDelta = vote === 'up' ? 1 : -1;
        const downDelta = vote === 'down' ? 1 : -1;
        tx.update(userRef, {
          reputationUp: FieldValue.increment(upDelta),
          reputationDown: FieldValue.increment(downDelta),
        });
      } else {
        // Voto nuevo
        const upDelta = vote === 'up' ? 1 : 0;
        const downDelta = vote === 'down' ? 1 : 0;
        tx.update(userRef, {
          reputationUp: FieldValue.increment(upDelta),
          reputationDown: FieldValue.increment(downDelta),
          reputationCount: FieldValue.increment(1),
        });
      }

      tx.set(voteRef, {
        vote,
        voterUid,
        at: FieldValue.serverTimestamp(),
      });

      return { ok: true, wasNew: !existingVote.exists };
    });
  },
);
