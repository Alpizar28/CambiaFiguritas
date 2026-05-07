# Implementacion - App Album Mundial

## Plan activo

- [x] Crear seguimiento de implementacion.
- [x] Inicializar proyecto Expo TypeScript en `app/`.
- [x] Configurar estructura base `src/`.
- [x] Instalar dependencias iniciales del stack.
- [x] Verificar proyecto base con checks disponibles.

## Fase 1 iniciada

- [x] Crear navegacion principal con bottom tabs.
- [x] Crear pantallas base: Album, Matches, Eventos y Perfil.

## Fase 2 iniciada

- [x] Definir tipos `Sticker`, `AlbumPage`, `StickerStatus`.
- [x] Crear datos mock del album con 2 paginas y 24 figuritas.
- [x] Crear `albumStore` con Zustand.
- [x] Crear `StickerCard` con estados visuales.
- [x] Crear `AlbumProgress`.
- [x] Actualizar pantalla Album con selector de pagina y grilla interactiva.
- [x] Agregar busqueda local por numero o seleccion.
- [x] Agregar filtros locales por estado: todas, faltantes, obtenidas, repetidas y especiales.
- [x] Ajustar doble tap para evitar cambio intermedio a obtenida.
- [x] Reemplazar mock chico por modelo Mundial 2026: 48 paises x 20 figuras + 20 especiales = 980.
- [x] Cambiar navegacion del album a selector por pais y especiales.
- [x] Agregar progreso visible por pais/especiales.
- [x] Actualizar modelo con orden exacto del CSV: Specials + Group A-L.
- [x] Ajustar total a 981 figuritas: 21 especiales + 48 paises x 20.
- [x] Implementar layout visual por pais en 2 paginas 4x3.
- [x] Agregar slots no clickeables de info de pais y grupo.
- [x] Usar codigos unicos como `MEX1`, `ARG13`, `FW1`.
- [x] Redisenar UI para simular album abierto en desktop con dos paginas visibles.
- [x] Simplificar cartas: sin fotos, sin nombre de pais y sin texto de ayuda.
- [x] Mantener mobile con una pagina visible y toggle Pagina 1/Pagina 2.
- [x] Agregar botones anterior/siguiente para desplazarse entre paises.

## Fase 3 completada

- [x] Instalar `expo-auth-session`, `expo-web-browser`, `expo-crypto`.
- [x] Crear `src/services/firebase.ts` (config placeholder).
- [x] Crear `src/types/user.ts` con tipo `AppUser`.
- [x] Crear `src/store/userStore.ts` con Zustand.
- [x] Crear `src/services/userService.ts` (getOrCreateUser en Firestore).
- [x] Crear `src/features/auth/LoginScreen.tsx` con Google OAuth.
- [x] Actualizar `App.tsx` con auth gate + onAuthStateChanged.
- [x] Actualizar `ProfileScreen.tsx` con datos reales + logout.

## Pendiente (requiere datos del usuario)

- [ ] Reemplazar `REPLACE_ME` en `src/services/firebase.ts` con firebaseConfig real.
- [ ] Reemplazar `REPLACE_ME` en `src/features/auth/LoginScreen.tsx` con Web Client ID real.

## Fase actual

Fase 3: Firebase Auth — pendiente de config real del proyecto Firebase.

## Revision

- `npm run typecheck` pasa sin errores con los archivos de Fase 3.

## Fase 4 completada

- [x] Crear `src/services/albumSyncService.ts` (loadUserAlbum, saveUserAlbum).
- [x] Agregar `loadState` a albumStore.
- [x] Crear `src/hooks/useAlbumSync.ts` con debounce de 1.5s.
- [x] Actualizar App.tsx: cargar album de Firestore al login, resetear al logout.
- [x] Montar `useAlbumSync` en `AppWithSync` wrapper.

## Fase 5 completada

- [x] Agregar campo `whatsapp?` a AppUser.
- [x] Crear `matchingService.ts` con `findMatches` (query Firestore + score local).
- [x] Crear `matchStore.ts` con cache de 1 minuto.
- [x] Crear `MatchCard.tsx` con score, breakdown y botón WhatsApp.
- [x] Reescribir `MatchesScreen.tsx` con lazy fetch, refresh y estados vacíos.

## Fase 6 completada

- [x] Instalar `react-native-maps`.
- [x] Crear tipos `EventType` y `AppEvent`.
- [x] Crear `eventService.ts` con CRUD básico.
- [x] Crear `eventStore.ts` con Zustand.
- [x] Crear `EventCard.tsx` con detalles + botón Maps + delete (solo owner).
- [x] Crear `CreateEventModal.tsx` con formulario y captura de GPS.
- [x] Crear `EventsMap` con split por plataforma (native: react-native-maps, web: iframe OSM).
- [x] Reescribir `EventsScreen` con tabs Mapa/Lista, fetch al montar, integración con todo.

## Fase 7 completada

- [x] Crear `firestore.rules` con reglas para users, userAlbums, events.
- [x] Crear `firestore.indexes.json` (vacío, sin índices compuestos por ahora).
- [x] Crear `firebase.json` y `.firebaserc` para CLI de Firebase.
- [x] Documentar deploy en `tasks/firestore-rules.md`.

## Pendiente para vos

- [ ] Aplicar las reglas: `firebase deploy --only firestore:rules` o copiar/pegar en consola.

## Fase 8 completada

- [x] Crear `src/services/analytics.ts` con catálogo tipado de eventos y wrapper safe.
- [x] Instalar y configurar `react-native-google-mobile-ads` con plugin y test IDs.
- [x] Crear `src/services/ads.ts` con detección runtime + IDs por entorno.
- [x] Crear `src/components/AdBanner.tsx` cross-platform (no-op en Expo Go/web).
- [x] Inyectar tracking: login, logout, sticker_marked_owned, sticker_marked_repeated, matches_searched, match_whatsapp_clicked, event_created, event_deleted, event_maps_opened, screen_view.
- [x] Inyectar `AdBanner` como footer en MatchesScreen y EventsScreen (no en Album).
- [x] Agregar `measurementId` a firebase.ts para que Analytics web funcione.
- [x] Documentar setup AdMob real en `tasks/analytics-ads-setup.md`.

## Pendiente para vos

- [ ] (Opcional) Crear cuenta AdMob, registrar app, generar IDs reales y pegar en `app.json` y `src/services/ads.ts`.
- [ ] Para ver banners en celular, hacer EAS build (no funciona en Expo Go).

## Fase 9 completada

- [x] `StickerCard` envuelto en `React.memo` con comparador custom.
- [x] Crear `ConnectedStickerCard` que se conecta al store con selectors específicos por sticker (solo re-renderiza el sticker que cambió, no toda la grilla).
- [x] Estabilizar `handleLongPress` en AlbumScreen con `useCallback`.
- [x] Crear `Skeleton` reutilizable + `MatchCardSkeleton` + `EventCardSkeleton`.
- [x] Reemplazar spinners por skeletons en MatchesScreen y EventsScreen.
- [x] Crear `ErrorBoundary` global y montarlo en App.tsx.
- [x] Crear `syncStore` para estado del sync de Firestore.
- [x] Crear `SyncIndicator` flotante (pendiente / guardando / guardado / error).
- [x] Integrar status updates en `useAlbumSync`.

## Fase 10 - parcialmente completa

- [x] Configurar **Firebase Hosting** (`firebase.json` con cache headers).
- [x] Web export pipeline robusto (`npm run build:web` con patch `import.meta` + rehash bundle).
- [x] **Deploy web exitoso** → https://cambiafiguritas.web.app
- [x] **Reglas Firestore deployadas**.
- [x] Configurar **EAS Build** (`eas.json` profiles preview/production).
- [x] `app.json`: package + bundleId + permiso INTERNET.
- [x] **Repo GitHub**: https://github.com/Alpizar28/CambiaFiguritas (branch main).
- [x] README + docs actualizados para handoff entre dispositivos.
- [ ] Build Android AAB (requiere Play Console).
- [ ] Metadata store (descripción, screenshots).
- [ ] Smoke test E2E en build real.

## Persistencia local (fix crítico mid-sesión)

- [x] Instalar `@react-native-async-storage/async-storage`.
- [x] Wrap `albumStore` con zustand `persist` middleware.
- [x] Agregar `hasLocalData()` helper.
- [x] App.tsx: await rehydration antes de decidir hidratar de Firestore.
- [x] Lógica: local = source of truth, Firestore = backup cross-device.

## Fase actual

Fase 10 residual + mejoras detectadas. Ver `tasks/pendientes.md`.

---

# Roadmap MVP (post-deploy web 2026-05-06)

Reordenado por impacto + dependencias. Foco: web + Android (sin iOS nativo).

| # | Tarea | Estado | Estimación | Bloquea | Bloqueado por |
|---|-------|--------|------------|---------|---------------|
| T8 | Splash screen oscuro | ✅ Hecho | — | — | — |
| T1 | Auditoría Firestore rules | ✅ Deploy live | 5-6h | T5, T7 | — |
| T6 | Rename mockAlbum → albumCatalog | ✅ Hecho | 1.5-2h | — | — |
| T4 | Onboarding 4 slides | ✅ Hecho | 5-7h | — | — |
| T2 | Ícono de la app | ⏳ | 2-4h | T3 | — |
| T3 | EAS preview Android | ⏳ | 4-8h | Release | T2 |
| T5 | Compartir álbum link público | ⏳ | 12-16h | — | T1 |
| T7 | Push notifications | ⏳ | 14-20h | — | T1, T3 |

## T1 — Auditoría Firestore rules

Rules ya deployadas. Falta endurecer + tests.

- [ ] Validar que `users update` no permita mutar `uid`, `email`, `createdAt`.
- [ ] Validar tamaño de `description` y `creatorName` en events.
- [ ] Tests con `@firebase/rules-unit-testing` (NUEVO `firestore.rules.test.js`).
- [ ] Cubrir: anon read denied, no-owner write denied, mutación campos restringidos.
- [ ] Deploy `firebase deploy --only firestore:rules`.

## T2 — Ícono app

- [ ] Diseñar 1024x1024 (figurita estilizada + amarillo `#FFD600` + bg `#0A0A0A`).
- [ ] Reemplazar `app/assets/icon.png`, `adaptive-icon.png`, `favicon.png`, `splash-icon.png`.
- [ ] Cambiar `app.json` `android.adaptiveIcon.backgroundColor` a `#0A0A0A`.

## T3 — EAS preview Android

- [ ] Pre-flight: `npm run typecheck`, validar `app.json` package/bundle.
- [ ] Maps SDK Android API key en `app.json` `android.config.googleMaps.apiKey`.
- [ ] `eas build --platform android --profile preview`.
- [ ] Smoke E2E device real: login → sticker → match → evento → mapa.

## T6 — Auditoría Matches

`MatchesScreen` YA conectado a Firestore real. No es mock.

- [ ] Renombrar `app/src/features/album/data/mockAlbum.ts` → `albumCatalog.ts` (es catálogo oficial 981, no mock).
- [ ] Actualizar imports en `albumStore.ts`, `matchingService.ts`, `AlbumScreen.tsx`.
- [ ] E2E con 2 cuentas: marcar complementario, verificar match score > 0.
- [ ] TODO comment en `matchingService.ts` sobre paginación geo (YAGNI hasta >100 users).

## T4 — Onboarding

- [ ] NUEVO `app/src/store/onboardingStore.ts` (zustand persist `hasCompletedOnboarding`).
- [ ] NUEVO `app/src/features/onboarding/OnboardingScreen.tsx` (4 slides FlatList).
- [ ] Gate en `App.tsx` post-login antes de `AppWithSync`.
- [ ] Eventos analytics: `onboarding_started/skipped/completed`.
- [ ] Botón "Ver tutorial" en ProfileScreen.

## T5 — Compartir álbum (link público)

Requiere Cloud Function (upgrade a Blaze plan).

- [ ] Decidir: pasar a Blaze plan (cobra). Confirmar con usuario.
- [ ] NUEVO `functions/` dir con Cloud Functions.
- [ ] Trigger `users.onWrite` → sync a `publicProfiles/{uid}` (whitelist `name, photoUrl, city`).
- [ ] HTTPS function `getPublicAlbum?uid=xxx` que devuelve JSON limpio.
- [ ] NUEVO `app/src/features/share/PublicAlbumScreen.tsx` (read-only, sin login).
- [ ] Linking config en `NavigationContainer` para `/u/:uid`.
- [ ] Botón "Compartir álbum" en ProfileScreen + `expo-clipboard` + `Share.share`.
- [ ] Rules: `publicProfiles` read sin auth, write solo via Cloud Function.

## T7 — Push notifications

- [ ] `npx expo install expo-notifications expo-device`.
- [ ] Plugin en `app.json` + icon notif 96x96 transparente.
- [ ] NUEVO `app/src/services/pushService.ts` — registrar token, guardar en `users/{uid}.expoPushToken`.
- [ ] Cloud Function `notifyMatches` trigger en `userAlbums.onWrite`:
  - Recalcular matches del user.
  - Push a otros con score > N via Expo Push API.
  - Throttle 1 notif/user/24h (campo `lastNotifiedAt`).
- [ ] Deep link tap → MatchesScreen + scroll al match.
- [ ] Toggle "Notificaciones" en ProfileScreen (campo `pushEnabled`).
- [ ] Eventos analytics: `push_token_registered/received/tapped`.

## Riesgos cross-cutting

- Cloud Functions requieren Blaze plan (T5, T7). Validar OK pasar a pay-as-you-go antes.
- EAS build puede fallar por configs Maps/AdMob. Build dev primero local.
- Push spam → hard cap 1/24h.
- Compartir álbum expone PII si rules mal. Tests obligatorios pre-deploy.
