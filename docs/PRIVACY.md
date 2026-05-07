# Política de Privacidad — CambiaFiguritas

**Última actualización: 2026-05-07**

CambiaFiguritas es una app comunitaria para gestionar tu álbum del Mundial 2026 y encontrar otros coleccionistas con quien intercambiar figuritas. Respetamos tu privacidad y solo recopilamos los datos necesarios para que la app funcione.

## Qué datos recopilamos

### Datos que vos nos das
- **Nombre, foto y email**: provistos por Google al iniciar sesión. Se usan para identificarte en la app. **El email no se comparte con otros usuarios** y nunca aparece en perfiles públicos.
- **Ciudad** (opcional): la ingresás vos. Es visible para otros usuarios.
- **WhatsApp** (opcional): si lo cargás, será visible para cualquier usuario logueado para que puedan contactarte sobre intercambios. Si no querés que sea público, no lo cargues.
- **Estado de tu álbum**: qué figuritas tenés, repetidas o faltantes. Es visible para otros usuarios logueados (es la base del sistema de matches).
- **Reportes**: si reportás a un usuario, guardamos tu UID + el UID del reportado + el motivo. Solo el equipo de la app puede leer reportes.

### Datos que recopilamos automáticamente
- **Ubicación aproximada** (con tu permiso): si aceptás la permission de ubicación, redondeamos tu lat/lng a múltiplos de ~5 km antes de guardarla. Nunca guardamos tu ubicación exacta.
- **Eventos de uso anónimos**: a través de Google Analytics for Firebase. No incluimos tu email ni datos personales identificables. Identificadores de otros usuarios se hashean antes de enviarse.
- **Datos de anuncios** (Google AdMob): si aceptás el consentimiento de cookies, AdMob puede recopilar identificadores publicitarios para mostrar avisos personalizados. Si rechazás, recibirás avisos no personalizados.

## Cómo usamos tus datos

- Calcular matches con otros coleccionistas (comparando estados de álbum).
- Mostrar tu perfil público (nombre, foto, ciudad, WhatsApp si lo cargaste) a otros usuarios para que puedan contactarte.
- Ranking de matches por distancia aproximada.
- Eventos de meetup/intercambio: tu ubicación al crear un evento queda asociada al evento (también bucketeada a ~5 km).
- Mejora de la app vía analytics agregados.
- Mostrar publicidad (AdMob) cuando corresponda.

## Con quién compartimos tus datos

- **Otros usuarios logueados**: tu nombre, foto, ciudad, ubicación bucketeada, estado de álbum y WhatsApp (si lo cargaste). Tu email **no** se comparte.
- **Google Firebase / Firestore**: backend donde se almacenan tus datos. Sujetos a la política de privacidad de Google.
- **Google Analytics**: estadísticas de uso anonimizadas.
- **Google AdMob**: ver consentimiento UMP.
- **Nadie más**. No vendemos datos a terceros.

## Tus derechos

Podés en cualquier momento:

- **Ver tus datos**: tu perfil completo aparece en la pestaña "Perfil".
- **Corregir tus datos**: editar nombre/ciudad/WhatsApp desde tu perfil.
- **Eliminar tu cuenta**: en "Perfil" → "Eliminar mi cuenta". Eso borra:
  - Tu documento de usuario (`users/{uid}`).
  - Tu álbum (`userAlbums/{uid}`).
  - Los eventos que creaste.
  - Tu cuenta de autenticación de Firebase.
- **Retirar consentimiento de ads**: en "Perfil" → "Privacidad" → "Configurar consentimiento publicitario".
- **Contactarnos**: jokemtech@gmail.com.

## Conservación de datos

- Datos del usuario: hasta que eliminés tu cuenta.
- Reportes: hasta 12 meses para investigar abusos.
- Analytics agregados: indefinido pero no incluyen identificadores personales.

## Seguridad

- Todos los datos viajan por HTTPS (TLS).
- Reglas de Firestore restringen escritura solo al dueño y lectura solo a usuarios logueados.
- El email **nunca** se almacena en el documento público de usuario; vive solo en Firebase Auth.
- Las coordenadas se redondean antes de almacenarse para evitar revelar ubicaciones exactas.

## Menores de edad

CambiaFiguritas no está dirigido a menores de 13 años. Si tenés menos de 13, no uses la app sin supervisión de un adulto. Si nos enteramos de que recopilamos datos de un menor de 13 sin consentimiento, los borramos.

## Cambios

Si modificamos esta política, actualizaremos la fecha al principio del documento y te avisaremos en la app la próxima vez que la abras.

## Contacto

Para cualquier consulta: **jokemtech@gmail.com**.
