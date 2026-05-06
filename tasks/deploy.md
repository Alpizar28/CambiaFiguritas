# Deploy - CambiaFiguritas

## Web → Firebase Hosting

### Setup (una sola vez)

```bash
npm install -g firebase-tools
firebase login
```

### Cada deploy

Desde la raíz del repo:

```bash
# 1. Re-exportar build web (incluye patch import.meta para zustand devtools)
cd app && npm run build:web && cd ..

# 2. Deploy a Firebase Hosting
firebase deploy --only hosting
```

> El script `build:web` parchea `import.meta` → `({})` en el bundle JS porque
> Metro no transforma `import.meta.env` (sintaxis Vite que zustand/devtools usa)
> y rompe ejecución en browser sin `type="module"`.

URL final: `https://cambiafiguritas.web.app` y `https://cambiafiguritas.firebaseapp.com`

### Deploy combinado (hosting + reglas Firestore)

```bash
firebase deploy --only hosting,firestore:rules
```

### Auth domain - whitelist

Cuando esté live, agregar el dominio en Firebase Console:
**Authentication → Settings → Authorized domains**
- `cambiafiguritas.web.app`
- `cambiafiguritas.firebaseapp.com`
- (y cualquier custom domain que agregues después)

---

## Android → EAS Build

### Setup (una sola vez)

```bash
cd app
npm install -g eas-cli
eas login
eas build:configure   # detecta eas.json existente
```

### Build preview (APK para testing)

```bash
cd app
eas build --platform android --profile preview
```

Genera APK en la nube (~15min). Link de descarga al terminar. Instalar en celular real.

### Build production (AAB para Play Store)

```bash
cd app
eas build --platform android --profile production
```

Genera AAB. Subir a **Google Play Console → Release → Production → Create new release**.

### Submit automático (opcional, después de configurar service account)

```bash
eas submit --platform android --latest
```

---

## Pre-flight checklist

Antes de cada release production:

- [ ] Reemplazar Ad Unit IDs reales en `app/src/services/ads.ts`
- [ ] Reemplazar AdMob app IDs reales en `app/app.json` (`androidAppId`, `iosAppId`)
- [ ] Habilitar Maps SDK + agregar API key en `app/app.json` (`android.config.googleMaps.apiKey`)
- [ ] Reemplazar icono y splash placeholders en `app/assets/`
- [ ] Bump `version` en `app/app.json`
- [ ] `firebase deploy --only firestore:rules` aplicado
- [ ] Smoke test: login → marcar figurita → ver match → crear evento

---

## URLs útiles

- Firebase Console: https://console.firebase.google.com/project/cambiafiguritas
- Hosting: https://cambiafiguritas.web.app
- EAS Dashboard: https://expo.dev/accounts/_/projects/cambiafiguritas/builds
- Play Console: https://play.google.com/console
