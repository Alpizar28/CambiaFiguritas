# Analytics y Ads — Configuración

## Estado actual

- **Analytics**: 100% funcional en web. Eventos se loguean a Firebase Analytics. En nativo (Expo Go) los eventos se imprimen en consola en dev mode (`__DEV__`).
- **AdMob**: instalado y configurado con **test ads de Google**. El componente `AdBanner` solo renderiza en dev/EAS builds donde el módulo nativo está enlazado. En Expo Go y web no se ve nada (silent no-op).

## Eventos que ya se loguean

| Evento | Cuándo |
|--------|--------|
| `login_completed` | Al loguearse con Google |
| `logout` | Al cerrar sesión |
| `sticker_marked_owned` | Al marcar figurita como obtenida |
| `sticker_marked_repeated` | Al incrementar repetida (con count actual) |
| `matches_searched` | Al buscar matches (con cantidad encontrada) |
| `match_whatsapp_clicked` | Al tocar WhatsApp en un match |
| `event_created` | Al crear evento (con tipo) |
| `event_deleted` | Al eliminar evento propio |
| `event_maps_opened` | Al abrir Google Maps desde un evento |
| `screen_view` | Al cambiar de tab |

Ver en Firebase Console → Analytics → DebugView (para ver en vivo) o Eventos.

## Para activar AdMob en producción

### 1. Crear cuenta AdMob

- Ir a [admob.google.com](https://admob.google.com)
- Crear cuenta vinculada al proyecto Firebase `cambiafiguritas`

### 2. Registrar la app

- AdMob Console → Apps → Add app
- Crear una app por plataforma (Android, iOS) si vas a publicar en ambas
- Cada app te da un **App ID** con formato `ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY`

### 3. Crear unidades de anuncio

- Por cada app, crear:
  - 1 unidad **Banner** (para footer en Matches y Events)
  - 1 unidad **Interstitial** (opcional, para ocasiones puntuales)
- Cada unidad te da un **Ad Unit ID** con formato `ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY`

### 4. Reemplazar IDs en el código

**Archivo `app/app.json`** — reemplazar test App IDs por los reales:

```json
[
  "react-native-google-mobile-ads",
  {
    "androidAppId": "TU_ANDROID_APP_ID",
    "iosAppId": "TU_IOS_APP_ID",
    ...
  }
]
```

**Archivo `app/src/services/ads.ts`** — reemplazar las constantes:

```ts
const PROD_BANNER_ANDROID = 'TU_BANNER_AD_UNIT_ID_ANDROID';
const PROD_BANNER_IOS = 'TU_BANNER_AD_UNIT_ID_IOS';
const PROD_INTERSTITIAL_ANDROID = 'TU_INTERSTITIAL_AD_UNIT_ID_ANDROID';
const PROD_INTERSTITIAL_IOS = 'TU_INTERSTITIAL_AD_UNIT_ID_IOS';
```

En dev (Expo Go) seguirá usando test IDs automáticamente. En production builds usará los reales.

### 5. Probar en celular real

AdMob nativo NO funciona en Expo Go. Tenés que hacer un build con EAS:

```bash
cd app
npm install -g eas-cli
eas login
eas build:configure
eas build --profile development --platform android
```

Eso te genera un APK que podés instalar y donde sí se ven los banners.

## Eventos que vale la pena agregar más adelante

- `app_open` (cuando se abre la app desde fondo)
- `permission_granted_location`
- `match_card_pressed` (si se agregaran detalles del match)
- `profile_edited` (cuando exista la pantalla de editar perfil)

## Privacidad / GDPR

`react-native-google-mobile-ads` incluye soporte para mostrar el formulario de consentimiento de Google UMP. Antes de publicar:

```ts
import mobileAds, { AdsConsent } from 'react-native-google-mobile-ads';

await AdsConsent.requestInfoUpdate();
const status = await AdsConsent.loadAndShowConsentFormIfRequired();
```

Es obligatorio para usuarios europeos.
