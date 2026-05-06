# Pendientes - App Album Mundial

Estado al 2026-05-06.

---

## Para vos (acciones manuales)

### Fase 5 - Matching

- [ ] **Editar perfil propio en Firestore** para tener `whatsapp` y poder probar el botón de contacto.
  - Console Firebase → Firestore → `users/{tu-uid}` → agregar campo `whatsapp` (string, ej: `"+5491112345678"`).
- [ ] **Probar matching con segunda cuenta**: abrir la app en navegador incógnito, loguear con otra cuenta de Google y marcar figuritas para que aparezcan matches.

### Fase 6 - Eventos en Android

- [ ] **Habilitar Maps SDK for Android** en Google Cloud Console.
- [ ] **Crear API key** en APIs & Services → Credentials → Create credentials → API key.
- [ ] **Restringir la key** a tu app (package name + SHA-1) y a "Maps SDK for Android".
- [ ] **Pegar la key en `app/app.json`**:
  ```json
  "android": {
    ...
    "config": {
      "googleMaps": { "apiKey": "TU_API_KEY" }
    }
  }
  ```
- [ ] (iOS) Habilitar **Maps SDK for iOS** y agregar key bajo `ios.config.googleMapsApiKey`.

### Fase 7 - Reglas Firestore

- [ ] **Aplicar las reglas** desde la consola web (Firestore → Rules → pegar contenido de `firestore.rules`) o por CLI:
  ```bash
  npm install -g firebase-tools
  firebase login
  firebase deploy --only firestore:rules
  ```
- Detalles completos en `tasks/firestore-rules.md`.

### Fase 8 - AdMob (opcional, solo si vas a monetizar)

- [ ] **Crear cuenta AdMob** en [admob.google.com](https://admob.google.com), vinculada al proyecto Firebase.
- [ ] **Registrar la app** en AdMob Console → Apps → Add app (una por plataforma).
- [ ] **Generar Ad Unit IDs** para banner e interstitial, en cada plataforma.
- [ ] **Reemplazar test IDs** en `app/app.json` (`androidAppId`, `iosAppId`).
- [ ] **Reemplazar Ad Unit IDs prod** en `app/src/services/ads.ts`:
  ```ts
  const PROD_BANNER_ANDROID = 'TU_ID';
  const PROD_BANNER_IOS = 'TU_ID';
  const PROD_INTERSTITIAL_ANDROID = 'TU_ID';
  const PROD_INTERSTITIAL_IOS = 'TU_ID';
  ```
- [ ] **Hacer EAS build para ver los banners** (Expo Go no soporta módulos nativos custom).
- [ ] (Opcional) Agregar formulario de consentimiento UMP para usuarios europeos (GDPR).

Detalles completos en `tasks/analytics-ads-setup.md`.

### Deploy en celular real con Expo Go

- [ ] **Instalar Expo Go** en el celular desde Play Store / App Store.
- [ ] **Correr `npx expo start`** en la carpeta `app/`.
- [ ] **Escanear el QR** desde la app Expo Go.
- [ ] Verificar que el login con Google funcione (ya está configurado el redirect `cambiafiguritas://`).

### Fase 10 - Publicación MVP

- [ ] **Crear cuenta de Apple Developer** (USD 99/año) si querés publicar en iOS.
- [ ] **Crear cuenta de Google Play Console** (USD 25 una vez) para publicar en Android.
- [ ] **Configurar EAS** (`npx eas-cli login` + `eas build:configure`).
- [ ] **Diseñar icono y splash** definitivos (reemplazar los placeholders en `app/assets/`).
- [ ] **Definir bundle identifier** definitivo (ej: `com.tudominio.cambiafiguritas`).

---

## Para mí (implementación pendiente)

### Fase 9 - Performance y Pulido ✅

### Fase 10 - Publicación MVP

- [x] Configurar **EAS Build** (`eas.json` con perfiles preview/production).
- [x] Configurar **Firebase Hosting** para web (`firebase.json` con bloque hosting + cache headers).
- [x] Revisar permisos declarados en `app.json` (location + internet, package + bundleId).
- [ ] Generar build Android (APK preview / AAB prod) — requiere `eas login`.
- [ ] Deploy hosting (requiere `firebase login`). Comandos en `tasks/deploy.md`.
- [ ] Preparar metadata: descripción, screenshots, capturas en distintos tamaños.
- [ ] Smoke test end-to-end: login → marcar figurita → ver match → crear evento.

### Mejoras pendientes detectadas

- [ ] **Editar perfil**: hoy no hay UI para que el usuario complete `city`, `whatsapp`. Crear pantalla "Editar perfil" en ProfileScreen.
- [ ] **DatePicker** en CreateEventModal: hoy es input de texto, agregar `@react-native-community/datetimepicker`.
- [ ] **Filtrar eventos por distancia** (mismo enfoque que matches).
- [ ] **Manejo de errores global**: hoy varios catches solo loguean, mostrar toast/banner al usuario.
- [ ] **Borrado de cuenta**: requerido por políticas de Google Play.
- [ ] **Formulario UMP** para consentimiento de ads en Europa (Fase 8 plus).

---

## Fuera del MVP (documentado, no implementar ahora)

- OCR de figuritas individuales y de páginas completas.
- Sistema premium / suscripciones.
- Favoritos.
- Estadísticas avanzadas (porcentaje por grupo, ETA para completar, etc.).
- Filtros avanzados (por jugador, por color de equipo, etc.).
- Recomendaciones inteligentes de intercambio.
- Chat integrado (hoy se delega a WhatsApp).

---

## Estado actual de fases

| Fase | Estado |
|------|--------|
| 0 - Setup proyecto | ✅ Completa |
| 1 - Navegación + UI base | ✅ Completa |
| 2 - Album local (981 figuritas) | ✅ Completa |
| 3 - Firebase Auth | ✅ Completa |
| 4 - Persistencia Firestore | ✅ Completa |
| 5 - Matching + distancia | ✅ Completa |
| 6 - Eventos + mapa | ✅ Completa |
| 7 - Reglas seguridad | ✅ Completa (pendiente deploy manual) |
| 8 - Ads + Analytics | ✅ Completa (con test IDs, pendiente IDs reales) |
| 9 - Performance + Pulido | ✅ Completa |
| 10 - Publicación MVP | 🔜 Siguiente |
