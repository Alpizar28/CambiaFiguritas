# Pendientes - CambiaFiguritas

Estado al **2026-05-06**. App web live: https://cambiafiguritas.web.app

---

## ✅ Completado en esta sesión

- Persistencia local con zustand `persist` + AsyncStorage (fix crítico: stickers ya no se pierden si Firestore falla).
- Fase 10 setup web:
  - `firebase.json` con bloque hosting + cache headers.
  - `app/eas.json` con perfiles preview/production.
  - `app.json`: `android.package` + `ios.bundleIdentifier` = `com.cambiafiguritas.app`, permiso `INTERNET`.
  - Script `app/scripts/patch-web-bundle.js` (fix import.meta + rehash bundle).
  - `npm run build:web` integra todo.
- **Deploy web exitoso**: https://cambiafiguritas.web.app live y funcional (login Google operativo).
- **Reglas Firestore deployadas**.
- **Repo en GitHub**: https://github.com/Alpizar28/CambiaFiguritas (branch main).

---

## 🔜 Para vos (acciones manuales)

### Antes de poder probar matching real

- [ ] **Editar tu perfil en Firestore**: agregar campo `whatsapp` (string, formato `+54911...`). Console → Firestore → `users/{tu-uid}` → Add field.
- [ ] **Probar con segunda cuenta Google** (otro browser o incógnito) para que aparezcan matches.

### Maps SDK Android (cuando hagas EAS build)

- [ ] Habilitar **Maps SDK for Android** en Google Cloud Console.
- [ ] Crear API key (APIs & Services → Credentials).
- [ ] Restringir la key (package: `com.cambiafiguritas.app` + SHA-1 + Maps SDK).
- [ ] Pegarla en `app/app.json`:
  ```json
  "android": {
    "config": {
      "googleMaps": { "apiKey": "TU_API_KEY" }
    }
  }
  ```
- [ ] (iOS) Mismo proceso con `ios.config.googleMapsApiKey`.

### AdMob real (opcional, solo si vas a monetizar)

- [ ] Cuenta AdMob vinculada a Firebase `cambiafiguritas`.
- [ ] Registrar app por plataforma (Android, iOS) → genera App IDs.
- [ ] Crear unidades banner + interstitial → genera Ad Unit IDs.
- [ ] Reemplazar IDs en `app/app.json` (`androidAppId`, `iosAppId`) y `app/src/services/ads.ts` (`PROD_*`).
- [ ] EAS build (test ads no se ven en Expo Go).

Detalles completos en [`analytics-ads-setup.md`](./analytics-ads-setup.md).

### Publicación stores

- [ ] **Apple Developer Account** (USD 99/año) si querés publicar iOS.
- [ ] **Google Play Console** (USD 25 una vez) para Android.
- [ ] EAS Build production AAB → subir a Play Console → release production.
- [ ] Diseñar **icono y splash definitivos** (reemplazar placeholders en `app/assets/`).

---

## 🛠️ Para mí (implementación pendiente)

### Fase 10 - residual

- [ ] Generar build Android (AAB) con `eas build --profile production` cuando tengas Play Console.
- [ ] Preparar metadata store: descripción larga, screenshots en distintos tamaños (phone + tablet), feature graphic.
- [ ] Smoke test E2E: login → marcar figurita → ver match → crear evento (en build real, no Expo Go).

### Mejoras detectadas durante el desarrollo

- [ ] **Editar perfil**: pantalla en Profile para que el user complete `city` y `whatsapp` sin meterse a Firestore.
- [ ] **DatePicker** en `CreateEventModal`: hoy es input de texto. Usar `@react-native-community/datetimepicker`.
- [ ] **Filtrar eventos por distancia** (mismo enfoque que matches: Haversine + slider km).
- [ ] **Toast/banner global de errores**: hoy varios catch solo loguean. UX necesita feedback visible.
- [ ] **Borrar cuenta**: requerido por políticas de Google Play. Botón en Profile + Cloud Function que borre `users/{uid}` + `userAlbums/{uid}` + auth user.
- [ ] **UMP consent form** para ads en Europa (GDPR). Usar `AdsConsent` de `react-native-google-mobile-ads`.

---

## 🗂️ Fuera del MVP (documentado, no implementar)

- OCR de figuritas (individual y página completa).
- Sistema premium / suscripciones.
- Favoritos.
- Estadísticas avanzadas (ETA para completar, % por grupo, etc.).
- Filtros avanzados (por jugador, por color de equipo, etc.).
- Recomendaciones inteligentes de intercambio.
- Chat integrado (hoy se delega a WhatsApp).

---

## Estado de fases

| Fase                                       | Estado |
|--------------------------------------------|--------|
| 0 - Setup proyecto                         | ✅ |
| 1 - Navegación + UI base                   | ✅ |
| 2 - Album local (981 figuritas)            | ✅ |
| 3 - Firebase Auth                          | ✅ |
| 4 - Persistencia Firestore + AsyncStorage  | ✅ |
| 5 - Matching + distancia                   | ✅ |
| 6 - Eventos + mapa                         | ✅ |
| 7 - Reglas seguridad                       | ✅ deployadas |
| 8 - Ads + Analytics                        | ✅ con test IDs |
| 9 - Performance + Pulido                   | ✅ |
| **10 - Publicación MVP**                   | 🚧 web live, Android pendiente Play Console |

---

## URLs operativas

- **Web app**: https://cambiafiguritas.web.app
- **GitHub**: https://github.com/Alpizar28/CambiaFiguritas
- **Firebase Console**: https://console.firebase.google.com/project/cambiafiguritas
- **Firebase Analytics DebugView**: console → Analytics → DebugView (eventos en vivo).
- **EAS Dashboard**: https://expo.dev/accounts/_/projects/cambiafiguritas/builds (cuando hagas el primer build).
- **Play Console**: https://play.google.com/console (cuando tengas cuenta).
