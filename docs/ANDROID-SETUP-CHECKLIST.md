# Android Setup Checklist — Login Fix

Fecha: 2026-05-10
Contexto: Build 1.0.1 en Internal Testing crashea en login Google. Necesario registrar SHA-1 keys de Play en Firebase + crear Android OAuth Client.

## Fingerprints

### Upload key (clave de subida)

- SHA-1: `A2:50:8E:33:CD:F6:9B:9A:CC:22:21:51:BF:DA:A4:74:79:A1:07:EA`
- SHA-256: `6F:96:F4:12:2E:3D:22:F4:C7:2A:EE:AD:98:BA:06:90:A7:21:0D:C8:FA:BA:69:ED:B8:AB:0A:88:E4:E5:A4:EC`
- MD5: `7D:B8:C4:7D:38:6B:E8:B8:FF:75:3A:E7:34:3E:4E:C2`

### App signing key (clave de firma de aplicacion) — la que Google usa para firmar AAB que llega a usuarios

- SHA-1: `E8:33:86:91:EF:FD:DE:AC:FF:F6:BC:75:6D:60:4B:C1:9F:FE:95:FE`
- SHA-256: `62:EA:2D:1E:EC:46:0D:8F:51:93:2F:3F:DC:F7:6E:66:25:99:45:FA:47:B5:1C:80:A5:6F:36:1C:EB:FD:F8:0B`
- MD5: `3C:87:0A:F1:B0:0C:DE:F0:98:B4:77:9F:B0:75:52:D5`

## Pasos

### [x] 1. Firebase Console — registrar SHA-1

Console: <https://console.firebase.google.com/project/cambiafiguritas/settings/general>

- Apps > Android `com.cambiafiguritas.app` > Add fingerprint
- Pegar SHA-1 upload key
- Pegar SHA-1 app signing key (cuando este disponible)
- Pegar SHA-256 ambos (opcional pero recomendado)
- Save

### [x] 2. google-services.json actualizado

- 2 Android OAuth clients (type=1) — uno por SHA-1 firma + uno por SHA-1 upload
- 1 Web OAuth client (type=3)

### [x] 3. Cloud Console — Android OAuth Clients (auto-creados por Firebase)

URL: <https://console.cloud.google.com/apis/credentials?project=cambiafiguritas>

- `+ CREATE CREDENTIALS` > OAuth client ID
- Application type: **Android**
- Name: `CambiaFiguritas Android`
- Package name: `com.cambiafiguritas.app`
- SHA-1: pegar SHA-1 de **app signing key** (NO upload — porque es el que firma el AAB que llega a usuarios via Play)
- Create
- Copiar Client ID resultante (`<NUMEROS>-<HASH>.apps.googleusercontent.com`)

### [ ] 4. Cloud Console — verificar Web OAuth Client

URL: misma pagina Credentials. Buscar el client tipo "Web" con ID:

```
1058576446766-r6ktjd5ptkg0h44trgc0a2lbab3001r8.apps.googleusercontent.com
```

Click > verificar:

**Authorized JavaScript origins:**

- `https://cambiafiguritas.online`
- `https://cambiafiguritas.web.app` (si Firebase Hosting tiene este alias)
- `http://localhost:19006` (dev)

**Authorized redirect URIs:**

- `https://cambiafiguritas.online`
- `https://cambiafiguritas.online/__/auth/handler`
- `cambiafiguritas://`

### [x] 5. ANDROID_CLIENT_ID cableado en LoginScreen.tsx

```
ANDROID_CLIENT_ID = 1058576446766-ouul34ghmao4i652kb6ctvviu5cgi7e5.apps.googleusercontent.com
```

(El otro Android client con SHA-1 upload `1058576446766-6qv...` no se usa en runtime — Firebase lo creó automaticamente cuando se registro el SHA-1 de upload pero el flujo de auth nativo usa el de Play App Signing.)

### [ ] 6. Rebuild AAB

```bash
cd app
eas build --platform android --profile production
```

EAS incrementa versionCode auto. Esperar ~10-20 min.

### [ ] 7. Upload nuevo AAB a Play Console

- Play Console > Internal Testing > Create new release
- Upload AAB descargado de EAS
- Release notes: "Fix login Google + icono launcher"
- Review > Start rollout

### [ ] 8. Testers actualizan

5-30 min propagacion. Tester abre Play Store > app > Update.

## Verificacion

- Tap "Continuar con Google" en device tester
- Debe abrir selector cuentas Google
- Seleccionar cuenta > volver a app logueado en pantalla principal
- Si falla: pantalla muestra error con codigo Firebase (`auth/...`) — copiar y reportar
