# Guía completa — Publicar en Google Play Store

## Estado actual

| Item | Estado |
|---|---|
| Cuenta Play Console | ✅ Creada y verificada |
| Identidad verificada | ✅ Aprobada |
| Certificado HTTPS | ✅ cambiafiguritas.online |
| Política de privacidad | ✅ cambiafiguritas.online/privacidad |
| Ficha de Play Store | ✅ Redactada (ver PLAY-STORE-LISTING.md) |
| Testers CSV | ✅ docs/testers.csv (8/12 testers) |
| AAB de producción | ⏳ Pendiente (ver Paso 1) |

---

## Paso 1 — Generar el AAB (Android App Bundle)

Correr en terminal desde la carpeta del proyecto:

```bash
eas login
# Ingresá con tu cuenta de Expo

cd app
eas build --platform android --profile production
```

- El build tarda ~15 minutos en los servidores de Expo
- Al terminar, EAS manda un email con el link de descarga
- También queda en https://expo.dev bajo tu cuenta
- Bajar el archivo `.aab` y guardarlo (se sube a Play Console en el Paso 3)

---

## Paso 2 — Configurar la app en Play Console

### 2.1 Crear la aplicación

En https://play.google.com/console → **Crear aplicación**

| Campo | Valor |
|---|---|
| Nombre | Cambia Figuritas |
| Nombre del paquete | com.cambiafiguritas.app |
| Idioma predeterminado | Español (Latinoamérica) – es-419 |
| Tipo | Aplicación |
| Precio | Sin coste |

Aceptar las tres declaraciones y crear.

### 2.2 Ficha de Play Store

Ir a **Presencia en tienda → Ficha principal de Play Store**

**Descripción corta (máx. 80 caracteres):**
```
Intercambiá figuritas del Mundial 2026 con personas cerca tuyo. ¡Gratis!
```

**Descripción larga:** copiar de `docs/PLAY-STORE-LISTING.md` → sección "Descripción larga"

**Gráfico de presentación (Feature graphic):** imagen 1024×500 px (pendiente crear)

**Capturas de pantalla:** mínimo 2, resolución 1080×1920 px
- Álbum de figuritas
- Pantalla de matches
- Perfil de un match
- Rankings

**Icono:** usar `app/assets/icon.png` (ya es 1024×1024)

### 2.3 Política de privacidad

En **Configuración de la app → Política de privacidad**

URL: `https://cambiafiguritas.online/privacidad`

### 2.4 Clasificación de contenido

Ir a **Clasificación de contenido** → completar cuestionario IARC

Respuestas:
- Violencia → No
- Contenido sexual → No
- Lenguaje ofensivo → No
- Juegos de azar → No
- Compras integradas → **Sí**
- Interacción entre usuarios → **Sí** (perfil visible a otros usuarios)
- Ubicación compartida → **Sí** (ciudad/región, no coordenadas exactas)

Clasificación esperada: **PEGI 3 / Everyone**

### 2.5 Data Safety (Seguridad de los datos)

Ir a **Seguridad de los datos** → responder el formulario

| Dato | Propósito | Compartido | Encriptado |
|---|---|---|---|
| Nombre | Funcionalidad | No | Sí |
| Foto de perfil | Funcionalidad | No | Sí |
| Email | Cuenta de usuario | No | Sí |
| Ubicación aproximada | Funcionalidad | No | Sí |
| ID de dispositivo | Notificaciones push | No | Sí |
| Historial de compras | Compras integradas | Google Play | Sí |

- ¿Se recopilan datos? → **Sí**
- ¿Todo encriptado en tránsito? → **Sí**
- ¿Usuario puede pedir eliminación? → **Sí**

### 2.6 Preguntas de la app

Ir a **Configuración de la app → Preguntas sobre la app**

- ¿La app tiene anuncios? → **Sí** (Google AdMob, versión gratuita)
- ¿Público objetivo? → Mayores de 13 años
- ¿Contiene compras integradas? → **Sí**

---

## Paso 3 — Subir el AAB a Prueba interna

1. Ir a **Probar y publicar → Pruebas → Prueba interna**
2. **Crear nueva versión**
3. Subir el `.aab` descargado en el Paso 1
4. Aceptar los Términos de Firma de Aplicaciones de Play (primera vez)
5. Notas de versión: `Primera versión de prueba — CambiaFiguritas`
6. **Guardar y publicar**

La versión tarda unos segundos en estar disponible para prueba interna.

---

## Paso 4 — Configurar Prueba cerrada (obligatoria, 14 días)

> Google exige prueba cerrada con mínimo 12 testers durante 14 días continuos para poder publicar en producción.

### 4.1 Crear el track de prueba cerrada

1. Ir a **Probar y publicar → Pruebas → Prueba cerrada**
2. **Crear track** → nombre: `Beta`
3. Subir el mismo `.aab` (o promover desde Prueba interna)
4. En **Testers** → seleccionar **Lista de correos electrónicos**
5. **Crear lista** → nombre: `Testers iniciales`
6. Importar CSV: subir `docs/testers.csv`
   - O agregar manualmente los emails uno por uno
7. Guardar y publicar el track

### 4.2 Obtener el link de opt-in

Después de publicar el track, Play Console genera un **link de invitación**.

Ir a **Prueba cerrada → Testers → Ver link de opt-in**

El link tiene este formato:
```
https://play.google.com/apps/testing/com.cambiafiguritas.app
```

### 4.3 Instrucciones para los testers

Mandar este mensaje por WhatsApp a cada tester:

---

> Hola! Te invito a probar CambiaFiguritas antes de que salga oficialmente en Play Store.
>
> **Pasos:**
> 1. Abrí este link desde tu celular Android: [LINK DE OPT-IN]
> 2. Tocá "Unirse al programa de pruebas"
> 3. Descargá la app desde Play Store
> 4. Usala aunque sea una vez
>
> **Importante:** no la desinstales durante los próximos 14 días. Es un requisito de Google para que pueda publicarla.
>
> ¡Gracias!

---

### 4.4 Testers actuales (8/12)

| Email | Estado |
|---|---|
| jpablo2807xd@gmail.com | Pendiente invitar |
| garrokembly@gmail.com | Pendiente invitar |
| gpt.2125@gmail.com | Pendiente invitar |
| alpizarbackup@gmail.com | Pendiente invitar |
| jokemtech@gmail.com | Pendiente invitar |
| stephaniemata2906@gmail.com | Pendiente invitar |
| jpabloalpizar@hotmail.com | Pendiente invitar |
| jpabloalpizar28@gmail.com | Pendiente invitar |
| _(vacío)_ | ⚠️ Faltan 4 más |
| _(vacío)_ | ⚠️ Faltan 4 más |
| _(vacío)_ | ⚠️ Faltan 4 más |
| _(vacío)_ | ⚠️ Faltan 4 más |

Agregar los 4 emails faltantes a `docs/testers.csv` y reimportar en Play Console.

---

## Paso 5 — Esperar 14 días

El contador empieza cuando cada tester **instala la app** (no cuando aceptan la invitación).

Durante estos 14 días:
- Verificar en Play Console que los testers aparezcan como activos
- Corregir cualquier bug que reporten
- Completar cualquier sección pendiente de la ficha (capturas, feature graphic)

---

## Paso 6 — Solicitar acceso a producción

Una vez cumplidos los 14 días con 12+ testers activos:

1. Ir al **Panel de control** de Play Console
2. Hacer clic en **Solicitar acceso a producción**
3. Completar el formulario de 3 partes:
   - Información sobre la prueba cerrada
   - Información sobre la app
   - Preparación para producción
4. Enviar solicitud

Google revisa en **hasta 7 días** y manda respuesta por email al propietario de la cuenta.

---

## Paso 7 — Publicar en producción

Si la solicitud se aprueba:

1. Ir a **Probar y publicar → Producción**
2. Crear nueva versión (promover desde prueba cerrada)
3. Elegir % de lanzamiento (recomendado empezar con 20%)
4. **Publicar**

---

## Checklist final antes de publicar

- [ ] AAB generado y subido
- [ ] Ficha de Play Store completa (descripción, capturas, icono, feature graphic)
- [ ] Política de privacidad configurada
- [ ] Data Safety completado
- [ ] Clasificación de contenido completada
- [ ] 12 testers con 14 días continuos
- [ ] Solicitud de acceso a producción aprobada
- [ ] Compras integradas configuradas en Play Console (si aplica)

---

## Archivos de referencia

| Archivo | Contenido |
|---|---|
| `docs/PLAY-STORE-LISTING.md` | Textos completos de la ficha, Data Safety, clasificación |
| `docs/testers.csv` | Lista de emails de testers para importar |
| `docs/PLAY-STORE-GUIA.md` | Este archivo |
| `app/web/privacidad.html` | Fuente de la política de privacidad |
