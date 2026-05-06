# Lecciones técnicas

Aprendizajes que valen guardar entre sesiones / dispositivos.

---

## Dominio del producto

- **Cardinalidad real**: Mundial 2026 = 48 países × 20 figuras + 21 especiales = **981** (no 980 como aparece en otras fuentes).
- **Fuente de verdad**: si el usuario provee CSV oficial, usarlo para orden, códigos (ej. `MEX1`, `ARG13`, `FW1`) y excepciones (`Che16`).
- **Códigos únicos**: usar el formato del álbum oficial (no índice numérico arbitrario), permite que el usuario los reconozca.

---

## Persistencia y estado

- **Local persiste siempre, cloud es backup**: zustand `persist` + AsyncStorage como source of truth. Firestore se hidrata solo si el local está vacío en ese device (primer login en device nuevo).
  - **Por qué**: Firestore-only deja al usuario sin sus stickers si el cloud falla u offline. Es un dealbreaker UX.
  - **Cómo aplicar**: chequear `useAlbumStore.persist.onFinishHydration()` antes de decidir si pullear de Firestore. Y mantener `hasLocalData()` helper en el store.
- **Debounce escrituras al cloud**: 1500ms post último cambio. Previene tormenta de writes al marcar varios stickers seguido.
- **Logout limpia local**: `resetAlbum()` ejecuta `set(initial)` que el `persist` middleware sobreescribe en AsyncStorage automáticamente. No hay que limpiar a mano.

---

## Expo Web export (SDK 54)

### `import.meta` en bundle no-module

**Problema**: zustand devtools usa `import.meta.env.MODE` (sintaxis Vite). Metro no lo transforma, emite el bundle como script clásico (no `type="module"`). Browser dispara `Cannot use 'import.meta' outside a module` y la app no monta (página en blanco).

**Fix**: post-export, sed `import.meta` → `({})` en todos los `.js` del bundle. Como está siempre dentro de un ternario que chequea su existencia, la sustitución es safe.

**Implementación**: `app/scripts/patch-web-bundle.js` ejecutado por `npm run build:web`.

### CDN cache invalidation

**Problema**: Metro hashea el bundle por contenido **pre-patch**. Mismo source = mismo filename. Firebase Hosting sirve assets JS con `cache-control: immutable max-age=1y`. Si modificás el archivo bajo mismo filename, browsers y CDN edges cachean la versión vieja indefinidamente.

**Fix**: post-patch, calcular MD5 del contenido patcheado, renombrar archivo, reescribir referencia en `index.html`. El script `patch-web-bundle.js` lo hace automático.

**Lección general**: si tocás un bundle post-export, **siempre rehashear el filename**. No confiar en cache busting por query string en script tags porque algunos CDN/proxies ignoran query strings para caching.

### Native-only modules en bundle web

Modules como `react-native-google-mobile-ads` y `react-native-maps` rompen web bundle si se importan directo. Patrones que funcionan:

1. **`Platform.OS === 'web'` early return**: simple, válido para utilities (`haptics.ts`, `ads.ts`).
2. **Dynamic `require()` dentro de useEffect**: para componentes (`AdBanner.tsx`). Metro evalúa runtime, web bundle no carga el módulo.
3. **`.web.tsx` / `.native.tsx` splits**: Metro elige automático según target. Mejor para componentes grandes (`EventsMap`).

---

## Firebase Hosting

### `ignore` patterns con `node_modules`

**Bug**: `firebase.json` con `**/node_modules/**` en `hosting.ignore` matchea cualquier path que contenga `node_modules`, incluyendo assets generados por Expo en `dist/assets/node_modules/@react-navigation/...`.

**Síntoma**: `firebase deploy` reporta menos archivos de los que el `dist/` realmente tiene. Iconos de navegación aparecen rotos en producción.

**Fix**: omitir ese pattern. El `dist/` típicamente no tiene un `node_modules` real al top level, así que no es necesario.

### Cache headers

- **HTML**: `cache-control: no-cache` (sino entry point queda cacheado y rompe deploys).
- **Assets hashed (JS, CSS, fonts, imgs)**: `cache-control: public, max-age=31536000, immutable` (1 año, hash invalida cuando cambia).

---

## Firebase Auth + dominios

- API keys de Firebase web **no son secretas** (están diseñadas para exponerse en client). La seguridad real está en Firestore Rules + Auth + AppCheck. OK commitear `firebase.ts` con keys hardcodeadas.
- Cada nuevo dominio (incluyendo previews) debe agregarse manualmente en **Authentication → Settings → Authorized domains** o el OAuth Google falla con `auth/unauthorized-domain`.

---

## Git / repo

- Project root es la raíz del git repo, no `app/`. `app/.git` que crea `expo create-app` es solo un init vacío, se puede borrar y reemplazar por repo a nivel project root.
- Excluir siempre: `node_modules/`, `dist/`, `.expo/`, `.firebase/`, `.claude/`, `.playwright-mcp/`, `.env*` (no `.env.example`).
- Las API keys de Firebase **se pueden** commitear (no son secretas). Las de AdMob también (no son secretas, identifican unit y app).

---

## EAS Build

- `app.json` necesita `android.package` + `ios.bundleIdentifier` antes del primer build (sin esto EAS pide configurarlos interactivo).
- Permiso `INTERNET` debería estar declarado explícitamente en `android.permissions` (Expo lo agrega por default pero conviene ser explícito).
- Perfiles típicos en `eas.json`:
  - `development`: dev client, APK, distribución interna.
  - `preview`: APK, distribución interna (testers).
  - `production`: AAB (Play Store), `autoIncrement: true`.
