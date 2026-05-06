# CambiaFiguritas

App multiplataforma para gestionar el álbum del **Mundial 2026**, encontrar intercambios cercanos y descubrir eventos de coleccionistas.

🟢 **Live (web):** https://cambiafiguritas.web.app
📦 **Repo:** https://github.com/Alpizar28/CambiaFiguritas
🔥 **Firebase Console:** https://console.firebase.google.com/project/cambiafiguritas

---

## Funcionalidades

- 🗂️ **Álbum completo**: 981 figuritas (48 países × 20 + 21 especiales) con orden oficial del CSV.
- 🔄 **Estados por figurita**: faltante, obtenida, repetida (con contador), especial.
- 💾 **Persistencia local + cloud**: AsyncStorage como source of truth + Firestore como backup cross-device.
- 🤝 **Matching geográfico**: encontrá usuarios cercanos con figuritas que vos necesitás.
- 📍 **Eventos**: mapa con intercambios, meetups y tiendas, geolocalizados.
- 🔐 **Auth Google**: OAuth con Firebase Auth (web + Expo).
- 📱 **WhatsApp deep link**: contacto directo con la persona del match.
- 📊 **Analytics + Ads**: Firebase Analytics + AdMob (test IDs por defecto).
- ⚡ **Performance**: virtualización, `React.memo`, selectors granulares por sticker.
- 🛡️ **Reglas Firestore**: validación server-side por usuario.

---

## Stack

| Capa            | Tecnología                                    |
|-----------------|----------------------------------------------|
| UI              | React Native + Expo SDK 54                   |
| Lenguaje        | TypeScript                                   |
| Estado          | Zustand (+ persist con AsyncStorage)         |
| Navegación      | React Navigation (Bottom Tabs)               |
| Backend         | Firebase (Auth + Firestore + Hosting)        |
| Mapas           | `react-native-maps` (native) / Leaflet (web) |
| Ads             | `react-native-google-mobile-ads` (AdMob)     |
| Analytics       | Firebase Analytics                           |
| Build móvil     | EAS Build                                    |
| Hosting web     | Firebase Hosting                             |

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
| 7 - Reglas seguridad                    | ✅     |
| 8 - Ads + Analytics (test IDs)          | ✅     |
| 9 - Performance + Pulido                | ✅     |
| **10 - Publicación MVP**                | 🚧 web live, Android EAS pendiente |

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
├── plan-fases-implementacion.md ← roadmap original
├── firebase.json              ← Hosting + Firestore config
├── .firebaserc                ← project ID (cambiafiguritas)
├── firestore.rules            ← reglas seguridad
├── firestore.indexes.json     ← índices compuestos (vacío)
├── tasks/                     ← documentación de operación
│   ├── deploy.md              ← cómo deployar (web + android)
│   ├── pendientes.md          ← TODO actual + checklist
│   ├── firestore-rules.md     ← detalles reglas
│   ├── analytics-ads-setup.md ← cómo activar AdMob real
│   ├── todo.md                ← log histórico de fases
│   └── lessons.md             ← aprendizajes técnicos
├── album mundial 2026 stiker .pdf ← álbum oficial (referencia)
├── StickerAlbumWC2026.xlsm - Stickers.csv ← orden oficial
└── app/                       ← código fuente Expo
    ├── App.tsx                ← root component + auth gate
    ├── app.json               ← Expo config (icons, plugins, perms)
    ├── eas.json               ← perfiles EAS Build
    ├── package.json
    ├── scripts/
    │   └── patch-web-bundle.js ← post-export patch (import.meta + rehash)
    ├── assets/                ← icon, splash, favicon
    └── src/
        ├── app/AppNavigator.tsx     ← bottom tabs
        ├── components/              ← UI compartida (icons, banner, skeleton, etc.)
        ├── constants/theme.ts       ← paleta + spacing + radii
        ├── features/
        │   ├── album/               ← grid figuritas + filtros + páginas país
        │   ├── auth/LoginScreen.tsx
        │   ├── matching/            ← MatchCard + MatchesScreen
        │   ├── events/              ← EventsScreen + mapa + modal crear
        │   └── profile/ProfileScreen.tsx
        ├── hooks/useAlbumSync.ts    ← debounce save Firestore
        ├── services/
        │   ├── firebase.ts          ← config + init
        │   ├── userService.ts       ← getOrCreateUser
        │   ├── albumSyncService.ts  ← load/save album
        │   ├── matchingService.ts   ← findMatches + score
        │   ├── eventService.ts      ← CRUD eventos
        │   ├── analytics.ts         ← wrapper Firebase Analytics
        │   └── ads.ts               ← AdMob ID resolver
        ├── store/                   ← Zustand stores
        │   ├── albumStore.ts        ← persist + statuses + repeatedCounts
        │   ├── userStore.ts
        │   ├── matchStore.ts
        │   ├── eventStore.ts
        │   └── syncStore.ts
        ├── types/                   ← navigation, user
        └── utils/haptics.ts
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
   Web (export)          Android/iOS
   Firebase Hosting      EAS Build → Stores
       │                     │
       └──────────┬──────────┘
                  │
            Firebase SDK
                  │
   ┌──────────────┼──────────────────┐
   │              │                  │
Firestore     Firebase Auth     Firebase Analytics
   │
   ├── users/{uid}            (perfil)
   ├── userAlbums/{uid}        (statuses + repeatedCounts)
   └── events/{id}             (intercambios + GPS)
```

Detalles de UX, paleta y filosofía en [`arquitectura.md`](./arquitectura.md).

---

## Workflow git (deploy completo)

```bash
# 1. Hacer cambios en código
cd app && npm run typecheck

# 2. Build web local
npm run build:web && cd ..

# 3. Test local opcional
cd app && npx serve dist -l 5050 && cd ..

# 4. Deploy a producción
firebase deploy --only hosting

# 5. Commit + push
git add .
git commit -m "feat: <descripción>"
git push
```

---

## Pendientes principales

Ver lista completa en [`tasks/pendientes.md`](./tasks/pendientes.md).

**Críticos para release Android:**
- [ ] Cuenta Google Play Console (USD 25 una vez).
- [ ] EAS build production AAB.
- [ ] Reemplazar AdMob test IDs por los reales.
- [ ] Maps SDK Android API key en `app/app.json`.
- [ ] Icono + splash definitivos en `app/assets/`.

**Mejoras detectadas:**
- [ ] UI editar perfil (city, whatsapp).
- [ ] DatePicker en CreateEventModal.
- [ ] Filtro de eventos por distancia.
- [ ] Toast/banner de errores global.
- [ ] Borrar cuenta (requerido por Google Play).
- [ ] UMP consent form (Europa/GDPR).

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
