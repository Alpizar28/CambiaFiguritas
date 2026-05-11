# CambiaFiguritas

App multiplataforma para gestionar el álbum del **Mundial 2026**, encontrar intercambios cercanos y descubrir eventos de coleccionistas.

🟢 **Live (web):** https://cambiafiguritas.web.app
📦 **Repo:** https://github.com/Alpizar28/CambiaFiguritas
🔥 **Firebase Console:** https://console.firebase.google.com/project/cambiafiguritas

---

## Funcionalidades

### Core
- 🗂️ **Álbum completo**: 981 figuritas (48 países × 20 + 21 especiales) con orden oficial del CSV.
- 🔄 **Estados por figurita**: faltante, obtenida, repetida (con contador), especial.
- 💾 **Persistencia local + cloud**: AsyncStorage como source of truth + Firestore como backup cross-device.
- 🔍 **Búsqueda fuzzy cross-país**: Levenshtein distance, tolerante a typos ("argntina" → Argentina).
- 🌟 **Wishlist**: marcar figuritas prioritarias, boost en scoring de matches.

### Matching (Tinder-style)
- 🎯 **Top 5 free / Top 10 premium** por búsqueda — solo los mejores, no inunda.
- 📍 **Filtros estrictos por zona**: chips "Mi ciudad" / "15 km" / "50 km" / "Todos". Default 15km.
- 📜 **Historial persistido**: cada búsqueda se guarda en `users/{uid}/matchHistory`. WhatsApp sigue clicable con prefijo "del DD/MM".
- ⭐ **Score combinado**: necesidades mutuas + wishlist boost + distancia.
- 🤝 **Intercambio perfecto**: badge dorado cuando swap recíproco balanceado.
- ✓ **Verified badge**: usuarios con ≥20 reputaciones y ≥85% positivas.
- 🛡️ **Cap diario server-enforced**: 1 búsqueda/día free (premium ilimitado).

### Eventos por zona
- 📍 **Filtro estricto**: GPS preferido (radio dinámico) + fallback `user.city` slug.
- 🏙️ **CityName + citySlug** por evento, con alias map (CABA → buenos-aires).
- 🆕 **FAB + EmptyZoneState** "¿Sos el primero en tu zona?".
- 🚫 **NoLocationBanner** si user sin GPS ni ciudad.

### Monetización
- ✨ **Premium USD 3.99** pago único — actualmente solo Web (TiloPay). Android (Play Billing) listo en código, en pausa esperando aprobación Play Console.
- 🔄 **Cross-platform sync**: misma cuenta Google → premium se refleja en segundos vía `onSnapshot`.
- 💸 **Audit trail**: subcollection `users/{uid}/entitlements/{source}` con idempotencia por externalId.
- 🎬 **Rewarded ads**: countdown 15s+ desbloquea +1 match cap diario.

### Compartir / OG
- 📤 **OG dinámico** `/u/:uid` + `/og/:uid.png` Cloud Function genera preview rich con stats.
- 📊 **Stats breakdown** por país.
- 📈 **Progress timeline** (últimos 14 días).

### Infra
- 🔐 **Auth Google**: OAuth con Firebase Auth (web + Expo).
- 📱 **WhatsApp deep link**: contacto directo con la persona del match.
- 📊 **Analytics + Ads**: Firebase Analytics + AdMob (test IDs por defecto).
- 🔔 **Push FCM**: notificaciones thank-you premium + álbum updates.
- 🛡️ **Reglas Firestore**: validación server-side, 32 tests automáticos.
- ⚡ **PWA**: service worker, install prompt, manifest.
- 🐛 **Sentry**: error tracking web/native con sourcemaps.

---

## Stack

| Capa            | Tecnología                                    |
|-----------------|----------------------------------------------|
| UI              | React Native + Expo SDK 54                   |
| Lenguaje        | TypeScript                                   |
| Estado          | Zustand (+ persist con AsyncStorage)         |
| Navegación      | React Navigation (Bottom Tabs)               |
| Backend         | Firebase (Auth + Firestore + Functions v2 + Hosting + FCM) |
| Cloud Functions | Node 20, callable + HTTPS + scheduled         |
| Mapas           | `react-native-maps` (native) / Leaflet (web) |
| Ads             | `react-native-google-mobile-ads` (AdMob)     |
| Analytics       | Firebase Analytics                           |
| Pagos           | TiloPay (web) + Google Play Billing (Android) |
| Errores         | Sentry (web + native, sourcemaps)            |
| Build móvil     | EAS Build                                    |
| Hosting web     | Firebase Hosting + PWA service worker        |

---

## Estado del proyecto

| Fase                                    | Estado |
|-----------------------------------------|--------|
| 0 - Setup proyecto                      | ✅     |
| 1 - Navegación + UI base                | ✅     |
| 2 - Álbum local (981 figuritas)         | ✅     |
| 3 - Firebase Auth                       | ✅     |
| 4 - Persistencia Firestore + AsyncStorage | ✅   |
| 5 - Matching + distancia                | ✅     |
| 6 - Eventos + mapa                      | ✅     |
| 7 - Reglas seguridad + 32 tests         | ✅     |
| 8 - Ads + Analytics                     | ✅     |
| 9 - Performance + Pulido                | ✅     |
| 10 - Publicación MVP web                | ✅     |
| Sprint A - Daily digest, perfect trade, verified, stats, fuzzy, OG | ✅ |
| Sprint B - Premium cross-platform, match cap, rewarded ads | ✅ |
| Sprint C - Eventos por zona             | ✅     |
| Sprint D - Matches Tinder-style + historial | ✅ |
| **Pendiente** - TiloPay keys reales, EAS Android build, AdMob real | 🚧 |

---

## Setup en un dispositivo nuevo

### 1. Requisitos

- **Node.js 20+** (recomendado vía `nvm`).
- **Git**.
- **Expo CLI** (no requiere instalación global, se usa `npx`).
- (Opcional móvil) **Expo Go** en el celular.

### 2. Clonar e instalar

```bash
git clone https://github.com/Alpizar28/CambiaFiguritas.git
cd CambiaFiguritas/app
npm install
```

### 3. Correr en desarrollo

```bash
# Web (browser)
npm run web

# Android (Expo Go o emulador)
npm run android

# iOS (solo Mac)
npm run ios

# Cualquiera (QR para Expo Go)
npm start
```

### 4. Variables y secretos

**No hay archivo `.env`.** La config Firebase está hardcodeada en `app/src/services/firebase.ts` (las API keys de Firebase son seguras de exponer — la seguridad real está en Firestore Rules + Auth).

> Si querés rotar el proyecto Firebase, cambiar el contenido de ese archivo + `.firebaserc` (project ID) y re-deployar reglas.

---

## Estructura del repo

```
CambiaFiguritas/
├── README.md                  ← este archivo
├── arquitectura.md            ← decisiones de diseño y UX
├── MANUAL_SETUP.md            ← prerequisitos manuales (TiloPay, Play Console, AdMob, EAS)
├── plan-fases-implementacion.md ← roadmap original
├── firebase.json              ← Hosting + Firestore + Functions config
├── .firebaserc                ← project ID (cambiafiguritas)
├── firestore.rules            ← reglas seguridad
├── firestore.indexes.json     ← índices compuestos (events.citySlug + date)
├── firestore-tests/           ← 32 tests rules con emulator
├── functions/                 ← Cloud Functions (Node 20 v2)
│   └── src/
│       ├── index.ts                       ← export central
│       ├── reputation.ts                  ← recordReputationVote
│       ├── notifications.ts               ← onAlbumUpdateNotify + sendPushSafe
│       ├── rankings.ts                    ← aggregateRankings (1h cron)
│       ├── digest.ts                      ← dailyDigest scheduled
│       ├── og.ts                          ← /u/:uid + /og/:uid.png
│       ├── matchSlots.ts                  ← consumeMatchSlot + unlockMatchSlot
│       ├── tilopay.ts                     ← createTilopayCheckout + webhook + devCompleteOrder
│       ├── playBilling.ts                 ← verifyPlayPurchase
│       └── payments/entitlement.ts        ← grantPremium helper compartido
├── tasks/                     ← documentación de operación
└── app/                       ← código fuente Expo
    ├── App.tsx                ← root + auth gate + subscribeUserDoc
    ├── app.json               ← Expo config
    ├── eas.json               ← perfiles EAS Build
    ├── scripts/
    │   ├── patch-web-bundle.js     ← post-export patch + PWA + sw + rehash
    │   └── upload-sourcemaps.sh    ← Sentry sourcemap upload
    └── src/
        ├── app/AppNavigator.tsx     ← bottom tabs (5)
        ├── components/              ← AdBanner, Tooltip, Skeleton, ErrorBoundary, icons
        ├── constants/theme.ts       ← paleta + spacing + radii + countryColors
        ├── features/
        │   ├── album/               ← grid figuritas + filtros + fuzzy search
        │   ├── auth/LoginScreen.tsx
        │   ├── demo/                ← demo mode con sample data
        │   ├── landing/             ← landing pública
        │   ├── matching/            ← MatchRow, MatchDetailModal, MatchHistoryScreen, filtros zona
        │   ├── events/              ← EventsScreen + filtro zona + FAB + modales city
        │   ├── profile/             ← ProgressTimeline, PremiumCard
        │   └── rankings/            ← RankingsScreen
        ├── hooks/useAlbumSync.ts
        ├── services/
        │   ├── firebase.ts                ← config + init
        │   ├── userService.ts             ← getOrCreateUser, subscribeUserDoc, saveUserLocation, setUserCity
        │   ├── albumSyncService.ts
        │   ├── matchingService.ts         ← findMatches (pool 200 sin slice)
        │   ├── matchSlotsService.ts       ← consumeMatchSlot/unlockMatchSlot wrappers
        │   ├── matchHistoryService.ts     ← saveMatchBatch + listMatchBatches + prune
        │   ├── eventService.ts            ← fetchEvents con EventFilter (gps/citySlug/none)
        │   ├── rankingsService.ts         ← rankings agregados
        │   ├── dailyStatsService.ts       ← snapshots diarios
        │   ├── playBilling.ts             ← lazy require react-native-iap
        │   ├── pushNotifications.ts       ← FCM token registration
        │   ├── webVitals.ts               ← Core Web Vitals → analytics
        │   ├── sentry.ts                  ← Sentry init web + native
        │   ├── analytics.ts               ← typed catalog ~60 eventos
        │   └── ads.ts
        ├── store/                   ← Zustand stores
        │   ├── albumStore.ts
        │   ├── userStore.ts
        │   ├── matchStore.ts
        │   ├── eventStore.ts
        │   ├── syncStore.ts
        │   ├── wishlistStore.ts          ← persist con AsyncStorage
        │   ├── tutorialStore.ts
        │   └── landingStore.ts
        ├── utils/
        │   ├── haptics.ts
        │   ├── distance.ts               ← haversineKm + formatDistance
        │   ├── citySlug.ts                ← slug + alias map AR (CABA→buenos-aires)
        │   └── shareImage.ts
        └── types/                   ← navigation, user
```

---

## Comandos clave

### Dev

```bash
cd app
npm install                # instalar deps (primera vez en cada device)
npm run web                # Expo dev server modo web
npm start                  # Expo dev server, QR Expo Go
npm run typecheck          # TypeScript --noEmit
```

### Build web (para hosting)

```bash
cd app
npm run build:web          # export web + patch bundle (import.meta + rehash)
```

> El `build:web` corre `expo export -p web` y después `node scripts/patch-web-bundle.js`. Ver sección "Tres bugs resueltos en Fase 10" abajo para el por qué.

### Deploy web (Firebase Hosting)

```bash
# Setup (una vez por device)
npm install -g firebase-tools
firebase login

# Cada deploy desde root del repo
cd app && npm run build:web && cd ..
firebase deploy --only hosting

# O combinado con reglas Firestore
firebase deploy --only hosting,firestore:rules
```

URL: https://cambiafiguritas.web.app + https://cambiafiguritas.firebaseapp.com

### Deploy Android (EAS Build)

```bash
# Setup (una vez)
npm install -g eas-cli
cd app
eas login
eas build:configure        # detecta eas.json existente

# APK preview (testing interno)
eas build --platform android --profile preview

# AAB production (Play Store)
eas build --platform android --profile production
```

Detalles completos en [`tasks/deploy.md`](./tasks/deploy.md).

---

## Auth Google: dominios autorizados

Después de deployar a un dominio nuevo, agregar en **Firebase Console → Authentication → Settings → Authorized domains**:
- `cambiafiguritas.web.app`
- `cambiafiguritas.firebaseapp.com`
- (cualquier custom domain que sumes después)

Sin esto el login Google falla con `auth/unauthorized-domain`.

---

## Tres bugs resueltos en Fase 10 (deploy web)

Documentados acá porque son no-obvios y pueden volver:

### 1. `firebase.json` ignoraba assets de `react-navigation`

**Síntoma:** `firebase deploy` reportaba "found 4 files" cuando el `dist/` tenía 15.

**Causa:** el patrón `**/node_modules/**` en `hosting.ignore` matcheaba `dist/assets/node_modules/@react-navigation/...` (los íconos export de react-navigation tienen literalmente `node_modules` en el path).

**Fix:** removí `**/node_modules/**` del ignore. El root `dist/` no tiene un node_modules real, así que no es necesario.

### 2. `Cannot use 'import.meta' outside a module`

**Síntoma:** página en blanco, console error, app no monta.

**Causa:** zustand (devtools middleware) usa `import.meta.env.MODE` (sintaxis Vite). Metro no transforma `import.meta` y emite el bundle como script clásico (no `type="module"`).

**Fix:** post-export, reemplazar `import.meta` → `({})` en el bundle. Como está dentro de un ternario (`import.meta.env ? import.meta.env.MODE : void 0`), la sustitución es safe (`({}).env` es `undefined` falsy → toma el `void 0`).

Implementado en `app/scripts/patch-web-bundle.js`.

### 3. CDN cache servía bundle viejo bajo mismo filename

**Síntoma:** después de re-deployar el bundle parcheado, el browser seguía mostrando el error de import.meta.

**Causa:** Metro hashea el bundle filename basado en contenido **pre-patch**. Mismo source → mismo hash → mismo filename. El `firebase.json` pone `cache-control: immutable max-age=1y` en assets JS. Browser y CDN caché siguen sirviendo la versión vieja del archivo.

**Fix:** después del patch, recalcular el hash MD5 del contenido patcheado, renombrar el archivo y reescribir la referencia en `index.html`. El script `patch-web-bundle.js` hace esto automático.

---

## Arquitectura resumida

```
        ┌────────────────────┐
        │ React Native (Expo)│
        └─────────┬──────────┘
                  │
       ┌──────────┴──────────┐
       │                     │
   Web (export+PWA)      Android/iOS
   Firebase Hosting      EAS Build → Stores
       │                     │
       └──────────┬──────────┘
                  │
            Firebase SDK
                  │
   ┌──────────────┼──────────────────────────┐
   │              │             │            │
Firestore  Firebase Auth   Functions v2   Analytics + FCM
   │
   ├── users/{uid}                       (perfil + premium + city/lat/lng + tz)
   │     ├── votes/{voterUid}            (reputación, backend-only)
   │     ├── dailyStats/{yyyymmdd}       (snapshots progreso)
   │     ├── matchSlots/{day}            (cap diario, backend-only)
   │     ├── entitlements/{source}       (audit premium, backend-only)
   │     └── matchHistory/{batchId}      (batches anteriores top 5/10)
   ├── userAlbums/{uid}                  (statuses + repeatedCounts)
   ├── events/{id}                       (intercambios + GPS + cityName + citySlug)
   ├── orders/{orderId}                  (pagos TiloPay/Play, backend-write)
   └── rankings/...                      (agregados por Cloud Function)

Cloud Functions:
  reputation, notifications, rankings (1h cron), digest (daily),
  og (HTTPS), matchSlots, tilopay (callable+webhook), playBilling
```

Detalles de UX, paleta y filosofía en [`arquitectura.md`](./arquitectura.md).

---

## Workflow git (deploy completo)

```bash
# 1. Cambios en app
cd app && npm run typecheck && npm run build:web && cd ..

# 2. Cambios en functions (si aplica)
cd functions && npm run build && cd ..

# 3. Cambios en rules (correr tests)
cd firestore-tests && npm test && cd ..

# 4. Deploy en orden seguro:
#    a) Indexes primero (esperar 5-15min "Built")
firebase deploy --only firestore:indexes

#    b) Hosting + Functions
firebase deploy --only hosting,functions

#    c) Rules (último, después de app desplegada con nuevo schema)
firebase deploy --only firestore:rules

# 5. Commit + push
git add app functions firestore.rules firestore.indexes.json firestore-tests MANUAL_SETUP.md
git commit -m "feat: <descripción>"
git push
```

---

## Pendientes principales

Detalles completos en [`MANUAL_SETUP.md`](./MANUAL_SETUP.md) y [`tasks/pendientes.md`](./tasks/pendientes.md).

**Críticos para producción real:**
- [ ] **TiloPay**: generar API keys + webhook secret, configurar en Functions secrets, confirmar payload con soporte. Hoy modo stub.
- [ ] **Google Play Console**: USD 25 fee + applicationId `com.cambiafiguritas.app` + producto IAP `cf_premium_lifetime` USD 3.99 + service account para `verifyPlayPurchase`.
- [ ] **EAS dev build**: instalar `react-native-iap` + build interno para probar Play Billing real.
- [ ] **AdMob real**: reemplazar test IDs por banners + rewarded + interstitial reales + UMP consent (Europa/GDPR).
- [ ] **Maps SDK Android API key** en `app/app.json`.
- [ ] **Borrar cuenta** (requerido por Google Play).

**Mejoras detectadas:**
- [ ] DatePicker en CreateEventModal (hoy texto manual).
- [ ] Backfill citySlug en eventos legacy (Cloud Function admin).
- [ ] RTDN Pub/Sub para refunds Play Billing → revoke premium.
- [ ] Geohash server-side queries cuando >5k events o >10k users.
- [ ] iOS App Store (post-Android).
- [ ] Dominio propio + AdSense.

---

## Lecciones aprendidas

Ver [`tasks/lessons.md`](./tasks/lessons.md). Highlights:

- Mundial 2026: 48 países × 20 figuras + 21 especiales = **981** (no 980).
- Si el usuario provee el CSV oficial, usarlo como fuente de verdad para orden y códigos (`MEX1`, `Che16`, etc.).
- **Persistencia local es no-negociable**: Firestore-only se pierde si el cloud falla. Zustand `persist` + AsyncStorage es source of truth, Firestore es backup cross-device.
- **`import.meta` en Metro**: zustand devtools rompe bundles web. Patch obligatorio.
- **Firebase Hosting cache `immutable max-age=1y`**: cambiar contenido bajo mismo filename = invisibilidad para clientes con cache. Rehash filename siempre que se modifique el bundle post-export.

---

## Licencia / autoría

Proyecto personal. No usar assets oficiales del Mundial protegidos por copyright.

---

🤖 Construido con ayuda de [Claude Code](https://claude.com/claude-code)
