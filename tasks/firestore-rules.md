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
