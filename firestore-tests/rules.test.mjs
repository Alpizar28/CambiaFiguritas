import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { test, before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';

const PROJECT_ID = 'cambiafiguritas';
const RULES_PATH = new URL('../firestore.rules', import.meta.url).pathname;

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  if (testEnv) await testEnv.clearFirestore();
});

const validUser = (uid) => ({
  uid,
  email: `${uid}@test.com`,
  name: 'Test User',
  photoUrl: null,
  city: '',
  premium: false,
  createdAt: '2026-01-01T00:00:00Z',
});

const validEvent = (creatorUid) => ({
  createdBy: creatorUid,
  title: 'Intercambio domingo',
  lat: -34.6,
  lng: -58.4,
  date: '2026-06-01',
  type: 'intercambio',
  description: 'Plaza Italia',
  creatorName: 'Pablo',
  cityName: 'Buenos Aires',
  citySlug: 'buenos-aires',
});

describe('users', () => {
  test('anon NO puede leer', async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, 'users/abc')));
  });

  test('auth puede leer cualquier user', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/alice'), validUser('alice'));
    });
    const bob = testEnv.authenticatedContext('bob').firestore();
    await assertSucceeds(getDoc(doc(bob, 'users/alice')));
  });

  test('owner puede crear su user', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(alice, 'users/alice'), validUser('alice')));
  });

  test('NO se puede crear user de otro', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, 'users/bob'), validUser('bob')));
  });

  test('owner NO puede mutar email', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/alice'), validUser('alice'));
    });
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(updateDoc(doc(alice, 'users/alice'), { email: 'hacker@x.com' }));
  });

  test('owner NO puede mutar uid', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/alice'), validUser('alice'));
    });
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(updateDoc(doc(alice, 'users/alice'), { uid: 'bob' }));
  });

  test('owner SÍ puede actualizar whatsapp + city', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/alice'), validUser('alice'));
    });
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(updateDoc(doc(alice, 'users/alice'), { whatsapp: '+5491123', city: 'BA' }));
  });

  test('NO se puede setear whatsapp >30 chars', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/alice'), validUser('alice'));
    });
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(updateDoc(doc(alice, 'users/alice'), { whatsapp: '1'.repeat(31) }));
  });

  test('user NO puede actualizar otro user', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/alice'), validUser('alice'));
    });
    const bob = testEnv.authenticatedContext('bob').firestore();
    await assertFails(updateDoc(doc(bob, 'users/alice'), { city: 'hack' }));
  });
});

describe('userAlbums', () => {
  test('anon NO puede leer', async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, 'userAlbums/alice')));
  });

  test('auth puede leer cualquier album (matching)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'userAlbums/alice'), { statuses: {} });
    });
    const bob = testEnv.authenticatedContext('bob').firestore();
    await assertSucceeds(getDoc(doc(bob, 'userAlbums/alice')));
  });

  test('owner puede escribir su album', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(alice, 'userAlbums/alice'), { statuses: { 'MEX1': 'owned' } }));
  });

  test('NO se puede escribir album ajeno', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, 'userAlbums/bob'), { statuses: {} }));
  });
});

describe('events', () => {
  test('anon NO puede leer', async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, 'events/e1')));
  });

  test('auth puede crear evento válido', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(alice, 'events/e1'), validEvent('alice')));
  });

  test('NO se puede crear con createdBy ajeno', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, 'events/e1'), validEvent('bob')));
  });

  test('NO se puede crear con type inválido', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, 'events/e1'), { ...validEvent('alice'), type: 'fiesta' }));
  });

  test('NO se puede crear con lat fuera de rango', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, 'events/e1'), { ...validEvent('alice'), lat: 200 }));
  });

  test('NO se puede crear con title >100 chars', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, 'events/e1'), { ...validEvent('alice'), title: 'x'.repeat(101) }));
  });

  test('NO se puede crear con description >500 chars', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, 'events/e1'), { ...validEvent('alice'), description: 'x'.repeat(501) }));
  });

  test('owner puede borrar su evento', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'events/e1'), validEvent('alice'));
    });
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(deleteDoc(doc(alice, 'events/e1')));
  });

  test('NO se puede borrar evento ajeno', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'events/e1'), validEvent('alice'));
    });
    const bob = testEnv.authenticatedContext('bob').firestore();
    await assertFails(deleteDoc(doc(bob, 'events/e1')));
  });

  test('NO se puede crear sin citySlug', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore();
    const { citySlug, ...rest } = validEvent('alice');
    await assertFails(setDoc(doc(alice, 'events/e1'), rest));
  });

  test('NO se puede crear con cityName >80 chars', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, 'events/e1'), { ...validEvent('alice'), cityName: 'x'.repeat(81) }));
  });

  test('owner NO puede cambiar citySlug en update', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'events/e1'), validEvent('alice'));
    });
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(updateDoc(doc(alice, 'events/e1'), { citySlug: 'rosario' }));
  });
});

describe('matchHistory', () => {
  const validBatch = (n = 3) => ({
    filterUsed: 'todos',
    userCity: 'Buenos Aires',
    userLat: -34.6,
    userLng: -58.4,
    matches: Array.from({ length: n }, (_, i) => ({
      uid: `m${i}`,
      name: `Match ${i}`,
      photoUrl: null,
      city: 'Buenos Aires',
      score: 5,
      distanceKm: 3,
      iNeedFromThem: 2,
      theyNeedFromMe: 3,
      iNeedIds: [],
      theyNeedIds: [],
      iNeedPriorityIds: [],
      premium: false,
      whatsapp: '',
    })),
    createdAt: new Date(),
  });

  test('owner puede crear batch válido', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(alice, 'users/alice/matchHistory/123'), validBatch(5)));
  });

  test('NO se puede crear batch >10 matches', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, 'users/alice/matchHistory/123'), validBatch(11)));
  });

  test('NO se puede crear con filterUsed inválido', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, 'users/alice/matchHistory/123'), { ...validBatch(3), filterUsed: 'invalid' }));
  });

  test('owner SÍ puede leer su propio batch', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/alice/matchHistory/123'), validBatch(3));
    });
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(getDoc(doc(alice, 'users/alice/matchHistory/123')));
  });

  test('user NO puede leer batch ajeno', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/alice/matchHistory/123'), validBatch(3));
    });
    const bob = testEnv.authenticatedContext('bob').firestore();
    await assertFails(getDoc(doc(bob, 'users/alice/matchHistory/123')));
  });

  test('owner puede borrar su batch', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/alice/matchHistory/123'), validBatch(3));
    });
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(deleteDoc(doc(alice, 'users/alice/matchHistory/123')));
  });
});

describe('catch-all', () => {
  test('colección random bloqueada', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, 'random/x'), { foo: 'bar' }));
    await assertFails(getDoc(doc(alice, 'random/x')));
  });
});
