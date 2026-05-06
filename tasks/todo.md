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

## Fase actual

Fase 10: Publicación MVP.
