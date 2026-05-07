# Firestore Rules Tests

Tests para `firestore.rules` con `@firebase/rules-unit-testing` + Firebase Emulator.

## Setup

```bash
cd firestore-tests
npm install
```

Requiere Java 11+ (ya hay 21 en el sistema).

## Correr tests

```bash
npm test
```

`firebase emulators:exec` levanta el emulator local, corre los tests con `node --test`, y mata el emulator al final.

## Cobertura

19 tests sobre 4 colecciones:
- **users**: anon read denied, auth read OK, owner create, no foreign create, no email/uid mutation, whatsapp size limit, no foreign update.
- **userAlbums**: anon read denied, auth read OK (matching), owner write, no foreign write.
- **events**: anon read denied, auth create válido, no foreign createdBy, type whitelist, lat range, title/description size limits, owner delete, no foreign delete.
- **catch-all**: colecciones desconocidas bloqueadas.
