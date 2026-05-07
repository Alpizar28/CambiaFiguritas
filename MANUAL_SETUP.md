# Manual Setup — Pendientes de configuración externa

> **Audiencia:** vos (Pablo) + cualquier dev futuro tomando el proyecto.
> **Estado del código:** Sprint A + Sprint B desplegados en producción (https://cambiafiguritas.web.app). Lo que sigue acá son **prerequisitos manuales** que requieren cuenta, dinero, o trámites externos. **NO es código pendiente** — el código ya está listo y deployeado, esperando solo que estos secrets/configs reales reemplacen los stubs.

**Última actualización:** 2026-05-07

---

## Tabla de contenidos

1. [Resumen rápido — qué falta](#resumen-rápido--qué-falta)
2. [TiloPay (web payment)](#1-tilopay-web-payment)
3. [Google Play Console + Play Billing (Android)](#2-google-play-console--play-billing-android)
4. [AdMob anuncios reales](#3-admob-anuncios-reales)
5. [EAS dev build (necesario para Android)](#4-eas-dev-build-necesario-para-android)
6. [Nice-to-have / opcional](#5-nice-to-have--opcional)
7. [Comandos de referencia](#comandos-de-referencia)

---

## Resumen rápido — qué falta

| Item | Costo | Tiempo de tu lado | Bloquea |
|---|---|---|---|
| TiloPay API key + webhook secret | Gratis (ya tenés cuenta) | ~30 min trámite | Pago real web (hoy funciona en modo stub) |
| Google Play Console developer fee | USD 25 (one-time) | ~1h alta + KYC | Distribuir Android + Play Billing |
| Service Account Play Billing | Gratis | ~30 min + 24h propagación | `verifyPlayPurchase` Cloud Function |
| Crear producto IAP en Play Console | Gratis | ~15 min | Compra Premium en Android |
| AdMob app + ad units reales | Gratis | ~30 min | Anuncios pagos (hoy son IDs de test) |
| EAS dev build (Expo) | Gratis tier alcanza | ~20 min config + 15 min build | Probar Play Billing local |
| AdSense aprobación (web ads) | Gratis | semanas (requiere dominio propio) | Anuncios web pagos |
| Dominio propio | ~USD 10/año | ~1h compra + DNS | AdSense + branding |

**Modo stub activo:** mientras estos no estén configurados, la app funciona con:
- Pago Premium → modal "Pago de prueba" que activa premium sin cobrar
- Anuncios → IDs de test de Google AdMob (no generan revenue)
- Android → no buildeado, app solo accesible vía web

---

## 1. TiloPay (web payment)

### 1.1 Estado actual del código
- `functions/src/tilopay.ts` ya tiene:
  - `createTilopayCheckout` callable
  - `tilopayWebhook` HTTPS function con validación HMAC-SHA256
  - `devCompleteOrder` callable de prueba (eliminar en producción)
- 3 secrets ya creados con valor stub `"STUB"`:
  - `TILOPAY_API_KEY`
  - `TILOPAY_MERCHANT_ID`
  - `TILOPAY_WEBHOOK_SECRET`

### 1.2 Lo que falta hacer

#### A. Generar las API keys reales
1. Iniciar sesión en https://tilopay.com/
2. Dashboard → **Configuración** → **API / Integraciones**
3. Generar:
   - **API Key** (también puede llamarse "Public Key" o "Integration Key")
   - **Merchant ID** (a veces es el "API User")
   - **Webhook Secret** (para firmar payloads — si TiloPay no lo expone, hay que pedirles que generen uno en soporte)

#### B. Subir secrets reales a Firebase
```bash
cd /home/pablo/Documentos/Personal/CambiaFiguritas

# Reemplazar las 3 versiones stub:
firebase functions:secrets:set TILOPAY_API_KEY
# (pegar key real cuando pida)

firebase functions:secrets:set TILOPAY_MERCHANT_ID
# (pegar merchant id)

firebase functions:secrets:set TILOPAY_WEBHOOK_SECRET
# (pegar webhook secret)

# Re-deploy las funciones que consumen los secrets:
firebase deploy --only functions:createTilopayCheckout,functions:tilopayWebhook
```

#### C. Configurar el webhook en TiloPay dashboard
- **Webhook URL:** `https://us-central1-cambiafiguritas.cloudfunctions.net/tilopayWebhook`
- **Eventos:** suscribirse a `payment.completed` (o nombre equivalente que use TiloPay; los términos varían: `approved`, `success`, `paid`).
- **Método:** POST con cuerpo JSON.
- **Algoritmo de firma:** HMAC-SHA256 sobre el raw body, header `X-Tilopay-Signature` (asumido — confirmar con TiloPay; si usan otro nombre de header, ajustar `tilopay.ts:152`).

#### D. Confirmar payload exacto del webhook
El código actual asume payload con campos `{ orderId, status, transactionId }`. Si TiloPay manda otra estructura, hay que ajustar el parser en `functions/src/tilopay.ts` función `tilopayWebhook`.

**Acción:** mandar mail/ticket a soporte TiloPay pidiendo:
- Documentación oficial del webhook (estructura de payload)
- Algoritmo de firma exacto + nombre del header
- Lista de status posibles (approved/declined/pending/etc)
- Endpoint POST para crear checkout (URL + body shape) — el código tiene un TODO en `createTilopayCheckout` con un esqueleto basado en supuestos

#### E. Endpoint de creación de checkout
Actualmente `createTilopayCheckout` retorna un stub aún con keys configuradas. Para activarlo, descomentar el bloque `fetch(...)` en `functions/src/tilopay.ts` (líneas marcadas `// TODO: integración real con TiloPay API`) y ajustar:
- URL del POST
- Headers (probable `Authorization: Bearer ${apiKey}` pero puede variar)
- Body con campos requeridos por TiloPay (orderId, amount, currency, successUrl, cancelUrl, webhookUrl)
- Parseo de la respuesta (campo `checkoutUrl` puede llamarse distinto)

#### F. Configurar URLs de retorno
En el dashboard TiloPay (o en el body del POST):
- **Success URL:** `https://cambiafiguritas.web.app/?premium=success`
- **Cancel URL:** `https://cambiafiguritas.web.app/?premium=cancel`

#### G. Smoke test antes de quitar stub
1. En sandbox de TiloPay (si lo tienen) hacer una compra de prueba
2. Verificar:
   - `orders/{orderId}` doc creado en Firestore con `status: 'pending'`
   - Webhook recibido (revisar `firebase functions:log --only tilopayWebhook`)
   - `users/{uid}.premium` cambia a `true` en <5s
   - Push thank-you llega
   - `users/{uid}/entitlements/tilopay` doc creado con `externalId`
3. Replay del webhook con mismo `orderId` → debe responder 200 sin doble grant (idempotencia).

#### H. Quitar `devCompleteOrder` en producción
El callable `devCompleteOrder` permite confirmar pagos sin TiloPay real. **Antes de salir a producción con TiloPay activo:**
- Comentar/eliminar el export en `functions/src/index.ts`
- O agregar guard: rechazar si `process.env.NODE_ENV === 'production'`

---

## 2. Google Play Console + Play Billing (Android)

### 2.1 Estado actual del código
- `functions/src/playBilling.ts` con `verifyPlayPurchase` callable usando `googleapis` package
- `app/src/services/playBilling.ts` con `purchasePremium()` (lazy require de `react-native-iap`)
- `PremiumCard.tsx` ya hace branch `Platform.OS === 'android'` → `purchasePremium()`
- Secret `PLAY_SERVICE_ACCOUNT_JSON` con valor stub `"STUB"`

### 2.2 Lo que falta hacer

#### A. Pagar developer fee
1. https://play.google.com/console/signup
2. Iniciar sesión con cuenta de Google que va a ser owner de la app
3. **Acceptar términos** + completar **identidad** (puede pedir foto de DNI o pasaporte)
4. Pagar **USD 25 one-time** con tarjeta de crédito
5. Esperar **48-72h** aprobación inicial (Google revisa la cuenta)

#### B. Crear la app en Play Console
1. https://play.google.com/console/ → **Create app**
2. Datos:
   - **Nombre:** CambiaFiguritas
   - **Idioma default:** Español (Argentina)
   - **Tipo:** App
   - **Free or paid:** Free (con compras in-app)
3. Llenar **store listing** (descripción, screenshots, ícono — usar el del PWA en `app/web/icon-512.png`)
4. **Content rating** questionnaire (responder honestamente)
5. **Target audience:** 13+ probablemente
6. **Data safety** declaration

#### C. Configurar el applicationId
En `app/app.json` (o `app.config.ts` si existe), confirmar/agregar:
```json
"android": {
  "package": "com.cambiafiguritas.app",
  "versionCode": 1
}
```
**Importante:** este `package` debe coincidir EXACTAMENTE con el que usás en Play Console y con la constante `PACKAGE_NAME` en `app/src/services/playBilling.ts`. Una vez publicado a Play, **no se puede cambiar**.

#### D. Crear el producto IAP en Play Console
1. Play Console → tu app → **Monetize → Products → In-app products** → **Create product**
2. Datos del producto:
   - **Product ID:** `cf_premium_lifetime` (debe coincidir con `PRODUCT_ID` en `app/src/services/playBilling.ts`)
   - **Name:** Premium
   - **Description:** Matches ilimitados, sin anuncios. Pago único de por vida.
   - **Default price:** USD 2.99 (Play autocalcula la moneda local)
   - **Status:** Active
3. **NO marcar como consumible** — es un upgrade permanente.

#### E. Crear service account para verificar compras
1. https://console.cloud.google.com/iam-admin/serviceaccounts?project=cambiafiguritas
2. **Create service account**
   - Name: `play-billing-verifier`
   - ID: `play-billing-verifier@cambiafiguritas.iam.gserviceaccount.com`
3. **Granted roles:** ninguno acá (los permisos se dan en Play Console).
4. Click el SA recién creado → **Keys** → **Add key → Create new key → JSON**
5. Descargar el JSON. **Tratar como contraseña** — no commitearlo.

#### F. Vincular Play Console al proyecto Cloud
1. Play Console → **Setup → API access**
2. **Choose project to link** → seleccionar `cambiafiguritas`
3. Bajo "Service accounts" debería aparecer el SA recién creado.
4. Click **Grant access** → asignar permisos:
   - **Financial data → View financial data, orders, and cancellation survey responses**
   - **Manage orders and subscriptions** (para acknowledge automático)
5. Confirmar.
6. **Esperar ~24h** — la propagación de permisos no es instantánea.

#### G. Subir el JSON del SA como secret
```bash
firebase functions:secrets:set PLAY_SERVICE_ACCOUNT_JSON --data-file ./play-sa-key.json
firebase deploy --only functions:verifyPlayPurchase
```
Después borrar el `play-sa-key.json` local del disco (`shred -u play-sa-key.json` o moverlo a `~/secrets/` fuera del repo).

#### H. Subir APK/AAB al internal testing track
**Requiere EAS dev build primero (sección 4).** Una vez tengas el AAB:
1. Play Console → **Testing → Internal testing → Create new release**
2. Upload AAB
3. **Notas de release:** "Initial test build"
4. Roll out → asignar testers (al menos tu propio email)
5. Una vez en internal track, podés probar compras IAP con la cuenta de tester (Google da auto-refund a las compras de prueba).

#### I. Smoke test
1. Instalar la app desde el link del internal track en un Android físico (con cuenta Google que sea tester)
2. Login → Profile → "Hacete Premium" → debería abrir el bottom sheet de Play Billing
3. Pagar (Play marca como prueba si la cuenta es tester)
4. Esperar callback → `verifyPlayPurchase` se ejecuta → verificar logs:
   ```bash
   firebase functions:log --only verifyPlayPurchase
   ```
5. `users/{uid}.premium` debería ser `true`
6. Abrir https://cambiafiguritas.web.app en desktop con misma cuenta Google → debería mostrar premium pill (cross-platform sync)

#### J. Real-Time Developer Notifications (post-launch, opcional)
Para detectar refunds/chargebacks automáticamente:
1. Crear topic Pub/Sub `play-rtdn` en Cloud Console
2. Play Console → **Setup → Monetization setup → Real-time developer notifications** → topic = `projects/cambiafiguritas/topics/play-rtdn`
3. Crear Cloud Function `playBillingRtdn` con trigger Pub/Sub que escuche el topic y revoque premium en refunds
4. **No está implementado todavía** — agregar en sprint futuro si hay refunds problemáticos

---

## 3. AdMob anuncios reales

### 3.1 Estado actual del código
- `app/src/services/ads.ts` tiene IDs de **test** de Google AdMob (siempre devuelven anuncio dummy, no generan revenue)
- `app/src/components/AdBanner.tsx` ya gateado para premium (no muestra a premium users)
- Constantes vacías:
  - `PROD_BANNER_ANDROID = ''`
  - `PROD_BANNER_IOS = ''`
  - `PROD_INTERSTITIAL_ANDROID = ''`
  - `PROD_INTERSTITIAL_IOS = ''`

### 3.2 Lo que falta hacer

#### A. Crear cuenta AdMob
1. https://admob.google.com/ → iniciar sesión con cuenta Google
2. Aceptar términos
3. **Add app** → seleccionar plataforma Android (y luego iOS si planeás iOS)
4. Linkear con la app que ya tengas en Play Console (después de hacer la sección 2.B)

#### B. Crear ad units
Para **Android**:
1. AdMob → tu app → **Ad units** → **Add ad unit**
2. Crear:
   - **Banner** — copiar el `Ad unit ID` resultante (formato `ca-app-pub-NNNNNNN/NNNNNNN`)
   - **Interstitial** (si querés mostrar interstitials después de N matches; no usado todavía)
   - **Rewarded** (CRÍTICO: para B2 — desbloquear matches con ads. Hoy el modal usa countdown sin ad real; cuando tengas este ID, hay que reemplazar el mock por AdMob real en native)
3. Repetir para iOS si aplica

#### C. Reemplazar IDs en código
Editar `app/src/services/ads.ts`:
```ts
const PROD_BANNER_ANDROID = 'ca-app-pub-XXXX/YYYY';     // tu ID real
const PROD_BANNER_IOS = 'ca-app-pub-XXXX/ZZZZ';
const PROD_INTERSTITIAL_ANDROID = '...';
const PROD_INTERSTITIAL_IOS = '...';
```

Agregar también constantes para rewarded (no existen todavía):
```ts
const PROD_REWARDED_ANDROID = '...';
const PROD_REWARDED_IOS = '...';
```

Y en `adUnitIds` exportado, agregar:
```ts
rewarded: __DEV__
  ? Platform.OS === 'android' ? 'ca-app-pub-3940256099942544/5224354917' : 'ca-app-pub-3940256099942544/1712485313'
  : Platform.OS === 'android' ? PROD_REWARDED_ANDROID : PROD_REWARDED_IOS,
```

#### D. Implementar rewarded ad real en native
Hoy `RewardedAdModal.tsx` (web) usa countdown timer. Para native, hay que conectar con AdMob:
- Modificar `app/src/services/ads.ts` agregando `showRewardedAd()` que use `react-native-google-mobile-ads` `RewardedAd.createForAdRequest(adUnitIds.rewarded)` y resuelva la promise cuando el evento `EARNED_REWARD` se dispare
- El callable `unlockMatchSlot` ya está listo del lado server

#### E. Configurar app-ads.txt (para PWA web ads)
**Solo si vas a hacer AdSense web** (sección 5). No bloquea launch.

#### F. Política de privacidad y consentimiento GDPR/CCPA
AdMob requiere:
- **Privacy policy URL** publicada (ej: `https://cambiafiguritas.web.app/privacy.html`) — falta crear
- **User Messaging Platform (UMP) SDK** integrado para mostrar consentimiento — el package `react-native-google-mobile-ads` lo incluye, pero hay que llamar `AdsConsent.requestInfoUpdate()` al boot

---

## 4. EAS dev build (necesario para Android)

### 4.1 Por qué
- `react-native-iap` (Play Billing) y `react-native-google-mobile-ads` (AdMob) **no funcionan en Expo Go** — requieren código nativo linkeado.
- Tenés que hacer un **development build** o **production build** con EAS para probar/distribuir.

### 4.2 Pasos

#### A. Instalar EAS CLI
```bash
npm install -g eas-cli
eas login
```
(Login con la cuenta Expo que tengas; si no tenés, crear en https://expo.dev/signup)

#### B. Configurar EAS
```bash
cd /home/pablo/Documentos/Personal/CambiaFiguritas/app
eas build:configure
```
Esto crea `eas.json` con perfiles `development`, `preview`, `production`.

#### C. Agregar `react-native-iap` al proyecto
**HOY NO ESTÁ INSTALADO.** Antes del primer build Android:
```bash
cd /home/pablo/Documentos/Personal/CambiaFiguritas/app
npx expo install react-native-iap
```
(Usar `expo install` no `npm install` para que valide compatibilidad con SDK 54).

Después agregar el plugin de Expo en `app.json`:
```json
"plugins": [
  "react-native-iap"
]
```

#### D. Crear development build
```bash
eas build --platform android --profile development
```
- Tarda ~15 min en cloud
- Al final te da un link a un APK descargable
- Instalar en device físico (habilitar "Install from unknown sources")

#### E. Probar local
```bash
npx expo start --dev-client
```
Abrir el dev build instalado y conectar al server local.

#### F. Build de producción (para Play Console internal track)
```bash
eas build --platform android --profile production
```
- Genera AAB
- Subir a Play Console → Internal testing release (sección 2.H)

#### G. EAS Submit (opcional — automatiza upload)
```bash
eas submit --platform android --profile production
```
Requiere configurar el SA key de Play Console en `eas.json` o variable de entorno.

---

## 5. Nice-to-have / opcional

### 5.1 Dominio propio
- Comprar dominio (ej: `cambiafiguritas.com` o `cambiafiguritas.app`) en Namecheap, Google Domains, o cualquier registrar (~USD 10-15/año)
- Firebase Console → Hosting → **Add custom domain** → seguir instrucciones DNS
- **Beneficios:**
  - SEO mejor (URL más memorable)
  - AdSense aprueba (no acepta `*.web.app`)
  - Branding profesional
- **Tiempo:** ~1h compra + DNS + 24h propagación

### 5.2 AdSense (anuncios web)
- Requiere dominio propio (sección 5.1)
- https://www.google.com/adsense/start/ → Get started
- Pegar el script `adsbygoogle.js` en `app/web/index.html` antes del `</head>`
- Esperar **revisión Google** (semanas)
- Crear ad units y reemplazar el AdBanner web (hoy es null) por `<ins class="adsbygoogle">` real

### 5.3 Sentry production release
- Ya configurado, pero verificar que el upload de sourcemaps esté corriendo en CI/CD (no solo local)
- Agregar GitHub Actions workflow que ejecute `npm run build:web && npm run sentry:upload` en cada push a main

### 5.4 RTDN (Play refunds automation)
- Documentado en sección 2.J — implementar después del primer launch si hay refunds problemáticos

### 5.5 iOS / App Store
- Cuando quieras distribuir en iOS:
  - Apple Developer Program: USD 99/año
  - Mismo flow que Play Console pero con StoreKit en vez de Play Billing
  - Crear `functions/src/appleIAP.ts` análogo a `playBilling.ts` (verifica receipts contra Apple)
  - **NO está implementado todavía** — agregar cuando decidas iOS

---

## Comandos de referencia

### Listar secrets actuales
```bash
firebase functions:secrets:access TILOPAY_API_KEY
firebase functions:secrets:list  # ver todos
```

### Deploy selectivo (solo lo que cambió)
```bash
# Solo functions:
firebase deploy --only functions

# Solo una función específica:
firebase deploy --only functions:tilopayWebhook

# Solo hosting + rules:
firebase deploy --only hosting,firestore:rules

# Todo Sprint A + B:
firebase deploy --only functions,hosting,firestore:rules
```

### Logs en tiempo real
```bash
firebase functions:log --only tilopayWebhook --limit 50
firebase functions:log --only verifyPlayPurchase --limit 50
firebase functions:log --only consumeMatchSlot --limit 50
```

### Forzar dailyDigest manualmente (testing)
```bash
# Listar jobs:
gcloud scheduler jobs list --location=us-central1 --project=cambiafiguritas

# Trigger:
gcloud scheduler jobs run firebase-schedule-dailyDigest-us-central1 --location=us-central1
```
(Requiere `gcloud` CLI instalado: https://cloud.google.com/sdk/docs/install)

### Borrar premium de un user (test)
Firestore Console → `users/{uid}` → editar `premium: false` + borrar `entitlements/tilopay` o `entitlements/play_billing` doc.

---

## Próximos pasos sugeridos en orden

1. **Esta semana:** TiloPay (sección 1) — desbloquea pago real web. Tenés cuenta, solo falta generar keys + confirmar webhook scheme.
2. **Cuando tengas USD 25 + tiempo:** Play Console (sección 2). Es el camino más largo (KYC + 48-72h aprobación + 24h SA propagación).
3. **Junto con Play Console:** EAS dev build (sección 4) — necesario para probar Play Billing.
4. **Después del primer test exitoso Android:** AdMob (sección 3) reemplazar IDs test por reales.
5. **Después de gain tracción:** dominio propio + AdSense (sección 5.1, 5.2).
6. **Si hay refunds:** RTDN (sección 2.J).

---

## Estado de los secrets (snapshot)

```
TILOPAY_API_KEY            → STUB  (necesita key real, sección 1.B)
TILOPAY_MERCHANT_ID        → STUB  (necesita merchant id real, sección 1.B)
TILOPAY_WEBHOOK_SECRET     → STUB  (necesita secret real, sección 1.B)
PLAY_SERVICE_ACCOUNT_JSON  → STUB  (necesita JSON del SA real, sección 2.G)
```

**Mientras estos sigan en STUB:**
- TiloPay funciona en modo "pago de prueba" (modal local que confirma sin cobrar)
- Play Billing fallará si se intenta — protegido con check `Platform.OS === 'android'` y la app web nunca lo invoca

---

## Notas finales

- **Dominio del webhook TiloPay** es estable: `https://us-central1-cambiafiguritas.cloudfunctions.net/tilopayWebhook`. No cambia entre deploys.
- **Idempotencia:** todos los grants Premium son idempotentes por `(uid, source, externalId)`. Si TiloPay reenvía un webhook por error, no se grantea dos veces.
- **Cross-platform sync:** ya funciona vía `onSnapshot` en App.tsx — no requiere config adicional. Probarlo es uno de los smoke tests.
- **Modo stub TiloPay** está integrado en `createTilopayCheckout` (retorna URL fake si secrets son stub o vacíos). NO requiere flag de feature aparte. Cuando subas keys reales, el comportamiento cambia automáticamente.

Cualquier item de esta lista que se cierre, **actualizá la fecha al inicio del documento + tachá la sección correspondiente** para mantener este doc accurate.
