// Texto legal embebido. Mantener sincronizado con /docs/PRIVACY.md y /docs/TERMS.md.
// Se actualiza la fecha en `LEGAL_VERSION` cuando cambia el contenido.

export const LEGAL_VERSION = '2026-05-07';

export const PRIVACY_TEXT = `# Política de Privacidad — CambiaFiguritas

Última actualización: ${LEGAL_VERSION}

CambiaFiguritas es una app comunitaria para gestionar tu álbum del Mundial 2026 y encontrar otros coleccionistas con quien intercambiar figuritas. Respetamos tu privacidad y solo recopilamos los datos necesarios para que la app funcione.

## Qué datos recopilamos

Datos que vos nos das:
• Nombre, foto y email — provistos por Google al iniciar sesión. El email no se comparte con otros usuarios y nunca aparece en perfiles públicos.
• Ciudad (opcional) — la ingresás vos. Es visible para otros usuarios.
• WhatsApp (opcional) — si lo cargás, será visible para cualquier usuario logueado para que puedan contactarte. Si no querés que sea público, no lo cargues.
• Estado de tu álbum — qué figuritas tenés, repetidas o faltantes. Es visible para otros usuarios logueados (es la base del sistema de matches).
• Reportes — si reportás a un usuario, guardamos tu UID + el del reportado + motivo. Solo el equipo puede leerlos.

Datos automáticos:
• Ubicación aproximada (con tu permiso) — redondeada a múltiplos de ~5 km antes de guardarse. Nunca se almacena la ubicación exacta.
• Eventos de uso anónimos vía Firebase Analytics. Sin email, sin PII. Identificadores hasheados.
• AdMob — si aceptás el consentimiento, identificadores publicitarios para avisos personalizados; si rechazás, avisos no personalizados.

## Cómo usamos tus datos

• Calcular matches comparando estados de álbum.
• Mostrar tu perfil público a otros usuarios.
• Ranking por distancia aproximada.
• Eventos: la lat/lng al crear queda asociada al evento (también bucketeada).
• Mejora de la app vía analytics agregados.
• Mostrar publicidad cuando corresponda.

## Con quién compartimos

• Otros usuarios logueados: nombre, foto, ciudad, ubicación bucketeada, estado de álbum, WhatsApp si lo cargaste. El email NO se comparte.
• Google Firebase / Firestore: backend.
• Google Analytics: estadísticas anonimizadas.
• Google AdMob: ver consentimiento UMP.
• Nadie más. No vendemos datos.

## Tus derechos

• Ver tus datos en "Perfil".
• Corregir nombre/ciudad/WhatsApp.
• Eliminar tu cuenta en "Perfil" → "Eliminar mi cuenta": borra users, userAlbums, eventos creados y la cuenta de auth.
• Retirar consentimiento de ads en "Perfil" → "Configurar publicidad".
• Contactarnos: jokemtech@gmail.com.

## Conservación

• Tu cuenta: hasta que la borres.
• Reportes: hasta 12 meses.
• Analytics agregados: indefinido sin PII.

## Seguridad

• HTTPS en toda comunicación.
• Reglas de Firestore restringen escritura al dueño y lectura a logueados.
• Email solo en Firebase Auth, nunca en el doc público.
• Coords redondeadas antes de almacenarse.

## Menores

No está dirigido a menores de 13. Si nos enteramos, borramos sus datos.

## Cambios

Si cambia esta política actualizamos la fecha y te avisamos al abrir la app.

## Contacto

jokemtech@gmail.com
`;

export const TERMS_TEXT = `# Términos de uso — CambiaFiguritas

Última actualización: ${LEGAL_VERSION}

Al usar CambiaFiguritas aceptás estos términos. Si no estás de acuerdo, no la uses.

## 1. Qué es

App gratuita y comunitaria para coleccionistas. NO tenemos relación con FIFA ni Panini ni ninguna marca oficial. Las figuritas se identifican solo con códigos genéricos (ARG3, MEX1, etc).

## 2. Tu cuenta

• Tenés que tener al menos 13 años.
• Iniciás sesión con Google. Mantené segura tu cuenta de Google.
• Podés eliminar tu cuenta cuando quieras desde Perfil.

## 3. Tu comportamiento

Sos responsable de lo que cargás. NO podés:
• Cargar contenido ofensivo, ilegal, falso o que vulnere derechos.
• Hacerte pasar por otra persona.
• Spam, estafa, scraping masivo o uso comercial sin autorización.
• Acceder a datos fuera de las funciones provistas.

Si rompés las reglas suspendemos o borramos la cuenta sin aviso.

## 4. Intercambios entre usuarios

CambiaFiguritas SOLO facilita el contacto. Cualquier intercambio es entre vos y la otra persona, bajo tu propio criterio y riesgo. NO nos hacemos responsables de:
• Pérdidas, robos o estafas durante intercambios.
• Calidad o autenticidad de figuritas.
• Encuentros presenciales: usá lugares públicos y acompañamiento.

## 5. Eventos

Los eventos cargados por usuarios son responsabilidad del organizador.

## 6. Disponibilidad

La app puede tener errores, caídas o cambios. Podemos modificar funciones o discontinuar partes. No garantizamos 24/7.

## 7. Propiedad intelectual

Vos sos dueño de tu contenido. Nos das licencia limitada para mostrarlo a otros usuarios mientras tengas cuenta. El código de la app es nuestro.

## 8. Limitación de responsabilidad

No nos hacemos responsables de daños indirectos, pérdida de datos, lucro cesante o cualquier consecuencia.

## 9. Cambios

Podemos modificar términos. Actualizamos la fecha y te avisamos en la app.

## 10. Ley aplicable

Ley de la República de Costa Rica. Tribunales de San José, Costa Rica.

## 11. Contacto

jokemtech@gmail.com
`;
