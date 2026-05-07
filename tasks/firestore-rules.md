# Firestore - Reglas de seguridad

## Archivos

- `firestore.rules` — reglas de seguridad declarativas.
- `firestore.indexes.json` — índices compuestos (vacío por ahora).
- `firebase.json` — configuración del CLI de Firebase.
- `.firebaserc` — apunta al proyecto `cambiafiguritas`.

## Cómo aplicar las reglas

### Opción 1 — Desde la consola web (rápido)

1. Firebase Console → tu proyecto → **Firestore Database** → pestaña **"Rules"**.
2. Copiar el contenido de `firestore.rules` y pegarlo.
3. Click **Publish**.

### Opción 2 — Desde la CLI (recomendado para mantener versionado)

```bash
# Instalar firebase-tools si no lo tenés
npm install -g firebase-tools

# Login (abre el browser)
firebase login

# Desde la raíz del repo (donde está firebase.json)
firebase deploy --only firestore:rules
```

## Resumen de lo que protegen las reglas

| Colección | Read | Write |
|-----------|------|-------|
| `users/{uid}` | Cualquier user logueado | Solo el dueño (uid debe coincidir) |
| `userAlbums/{uid}` | Cualquier user logueado | Solo el dueño |
| `events/{id}` | Cualquier user logueado | Crear: cualquier auth con `createdBy=uid`. Editar/borrar: solo el creador |
| `reports/{id}` | ❌ (solo backend/admin) | Crear: cualquier auth con `reporterUid=uid` y `reason` no vacío (≤500). No update/delete |
| Resto | ❌ | ❌ |

## Validaciones extra en `events`

Al crear:
- `title` debe ser string entre 1 y 100 chars.
- `lat` y `lng` deben ser números.
- `date` debe ser string.
- `type` solo puede ser `intercambio`, `meetup` o `tienda`.

Al editar:
- No se puede cambiar `createdBy`.

## Probar las reglas

Firebase Console → Firestore → Rules → **"Rules Playground"**.
Permite simular lecturas/escrituras con un uid concreto y ver si pasan o fallan.

## Decisiones tomadas

- **Lectura de `userAlbums` abierta a usuarios logueados**: necesaria para que `findMatches` itere sobre los albums de otros usuarios. Se podría restringir más adelante con Cloud Functions que devuelvan matches sin exponer el dataset crudo.
- **Lectura de `users` abierta a logueados**: necesaria para mostrar nombre/foto/ciudad de matches y creadores de eventos.
- **Lectura de `events` requiere auth**: si quisieras eventos públicos sin login, cambiar `allow read: if isSignedIn();` por `allow read: if true;`.
- **`reports` solo permite create**: read/update/delete bloqueados. Pensados para ser revisados desde un dashboard admin (Cloud Function o consola Firestore con cuenta dueña). Cada doc trae `reporterUid`, `targetUid`, `reason`, `createdAt`.

## Re-deploy tras cambios

Cada vez que se modifique `firestore.rules`, volver a ejecutar `firebase deploy --only firestore:rules` (o pegar manualmente en consola).

Cambios pendientes de deploy:
- Nueva colección `reports` (botón "Reportar usuario" del perfil de match).
- `users/{uid}`: ya no se permite el campo `email` en create. El email es PII y vive solo en Firebase Auth. Sin redeploy, los logins nuevos van a fallar al crear el doc.

## Privacidad — campos sensibles en `users/{uid}`

- **email**: prohibido en el doc público. Se lee de `auth.currentUser.email` para el dueño en runtime; nunca se expone a otros users.
- **lat / lng**: se persisten bucketeados a múltiplos de 0.05° (~5 km de precisión) en `saveUserLocation`. El pin del mapa cae sobre un bucket aproximado, no sobre la calle exacta. Suficiente para ranking por distancia sin revelar ubicación.
- **whatsapp**: opcional, lo carga el usuario explícitamente en su perfil. Quien lo ve en un MatchCard puede contactarlo (tradeoff aceptado).
- **photoUrl, name, city**: públicos por diseño.

El botón "Mapa" del perfil de match prioriza búsqueda por texto de ciudad, solo cae a coords bucketeadas si no hay city.
