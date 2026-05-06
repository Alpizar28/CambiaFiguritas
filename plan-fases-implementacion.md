# Plan de Implementacion por Fases

## Objetivo

Implementar una app multiplataforma para gestionar un album de figuritas del mundial, registrar faltantes y repetidas, encontrar matches de intercambio, descubrir eventos cercanos y preparar una monetizacion ligera con anuncios.

El foco del MVP es entregar una experiencia rapida, simple y publicable, sin depender de assets oficiales protegidos.

---

## Principios del MVP

- Priorizar velocidad de uso sobre cantidad de funciones.
- Mantener navegacion simple con maximo 4 tabs.
- Construir primero el album local antes de agregar backend.
- Evitar complejidad innecesaria en matching y eventos.
- Dejar OCR, premium y recomendaciones inteligentes fuera del MVP.

---

# Fase 0: Preparacion del Proyecto

## Objetivo

Crear la base tecnica del proyecto con Expo, React Native y TypeScript.

## Tareas

- Crear proyecto Expo con TypeScript.
- Configurar estructura base de carpetas.
- Instalar dependencias principales.
- Configurar aliases de imports si aplica.
- Definir tema visual inicial.
- Configurar linting y formato.

## Estructura esperada

```txt
src/
├── app/
├── components/
├── features/
├── hooks/
├── services/
├── store/
├── types/
├── constants/
└── utils/
```

## Resultado esperado

La app inicia correctamente en desarrollo y tiene una base ordenada para crecer.

## Criterio de cierre

- La app corre en Expo.
- TypeScript funciona sin errores base.
- Existe la estructura inicial del proyecto.

---

# Fase 1: Navegacion y UI Base

## Objetivo

Crear la navegacion principal y los componentes visuales iniciales.

## Tareas

- Implementar bottom tabs.
- Crear pantallas vacias para Album, Matches, Eventos y Perfil.
- Definir layout base compartido.
- Crear tokens visuales de color, spacing y bordes.
- Crear componentes iniciales: `StickerCard`, `AlbumPage`, `MatchCard`.
- Cargar datos mock para trabajar sin Firebase.

## Tabs del MVP

```txt
[ Album ]
[ Matches ]
[ Eventos ]
[ Perfil ]
```

## Resultado esperado

La app es navegable y ya comunica la direccion visual del producto.

## Criterio de cierre

- Las 4 tabs funcionan.
- Las pantallas principales renderizan sin errores.
- Existe una base visual coherente con el estilo minimalista deportivo.

---

# Fase 2: Sistema de Album Local

## Objetivo

Implementar el nucleo del producto: marcar figuritas faltantes, obtenidas y repetidas de forma rapida.

## Tareas

- Definir tipos TypeScript para figuritas, paginas y estados.
- Crear JSON de paginas del album.
- Renderizar figuritas desde coordenadas o layout definido por JSON.
- Implementar `albumStore` con Zustand.
- Implementar interacciones principales.
- Agregar progreso general del album.
- Agregar filtros y busqueda basica.

## Estados de figuritas

| Estado | Significado |
|---|---|
| `missing` | Faltante |
| `owned` | Obtenida |
| `repeated` | Repetida |
| `special` | Especial |

## Interacciones

| Accion | Resultado |
|---|---|
| Tap | Marcar como obtenida |
| Doble tap | Marcar como repetida |
| Long press | Abrir detalles |
| Swipe horizontal | Cambiar pagina |

## Resultado esperado

El usuario puede gestionar su album de forma local, sin autenticacion ni backend.

## Criterio de cierre

- Se pueden marcar figuritas.
- El estado visual cambia correctamente.
- El progreso se actualiza.
- La experiencia se siente rapida.

---

# Fase 3: Firebase Auth

## Objetivo

Permitir que el usuario inicie sesion y tenga un perfil persistente.

## Tareas

- Crear proyecto Firebase.
- Configurar Firebase SDK.
- Implementar login con Google.
- Crear `userStore`.
- Crear documento de usuario en Firestore al iniciar sesion.
- Mostrar datos basicos en Perfil.
- Implementar logout.

## Modelo inicial de usuario

```json
{
  "name": "",
  "photoUrl": "",
  "city": "",
  "premium": false,
  "createdAt": ""
}
```

## Resultado esperado

El usuario puede entrar, salir y ver su perfil basico.

## Criterio de cierre

- Login con Google funciona.
- Se crea o recupera el usuario en Firestore.
- Perfil muestra datos reales del usuario autenticado.

---

# Fase 4: Persistencia en Firestore

## Objetivo

Guardar el estado del album por usuario.

## Tareas

- Crear colecciones necesarias en Firestore.
- Sincronizar `user_stickers` con el estado local.
- Cargar el album del usuario al iniciar sesion.
- Manejar estados de carga y error.
- Optimizar escrituras para taps frecuentes.
- Evitar bloqueos de UI durante sincronizacion.

## Colecciones principales

```txt
users
stickers
user_stickers
```

## Modelo `user_stickers`

```json
{
  "userId": "",
  "stickerId": "",
  "status": "owned"
}
```

## Resultado esperado

El album queda guardado y se recupera entre sesiones.

## Criterio de cierre

- Cambios de figuritas persisten en Firestore.
- Al reiniciar la app se recupera el estado correcto.
- La UI sigue siendo rapida durante la sincronizacion.

---

# Fase 5: Matching Basico

## Objetivo

Encontrar usuarios compatibles para intercambio usando una logica simple.

## Tareas

- Implementar logica MVP de matching.
- Crear `matchStore`.
- Consultar repetidas y faltantes relevantes.
- Calcular score simple de intercambio.
- Crear pantalla de Matches.
- Crear `MatchCard` con cantidad de matches, distancia aproximada y contacto.
- Agregar boton de WhatsApp.

## Regla MVP

```txt
Usuario A necesita X.
Usuario B tiene X repetida.
Entonces existe match potencial.
```

## Resultado esperado

El usuario ve personas con las que podria intercambiar figuritas.

## Criterio de cierre

- Se listan matches compatibles.
- El score refleja cantidad de coincidencias.
- El contacto por WhatsApp funciona cuando hay telefono o link disponible.

---

# Fase 6: Eventos

## Objetivo

Mostrar y crear eventos de intercambio cercanos.

## Tareas

- Implementar pantalla Eventos.
- Integrar mapa simple con Google Maps.
- Crear modelo `events` en Firestore.
- Mostrar eventos en el mapa.
- Permitir crear eventos propios.
- Validar titulo, fecha y ubicacion.
- Mostrar tipos de evento: intercambio, meetup o tienda.

## Modelo `events`

```json
{
  "title": "",
  "lat": 0,
  "lng": 0,
  "date": "",
  "createdBy": ""
}
```

## Resultado esperado

El usuario puede descubrir lugares o encuentros donde intercambiar figuritas.

## Criterio de cierre

- El mapa muestra eventos.
- El usuario puede crear un evento.
- Solo el creador puede editar su evento cuando existan reglas de seguridad.

---

# Fase 7: Seguridad y Reglas

## Objetivo

Proteger los datos de Firestore antes de publicar.

## Tareas

- Escribir reglas de seguridad para `users`.
- Escribir reglas para `user_stickers`.
- Escribir reglas para `events`.
- Definir lecturas publicas necesarias.
- Probar casos permitidos y denegados.
- Revisar que no existan escrituras abiertas.

## Reglas esperadas

- Cada usuario puede editar solo sus datos.
- Cada usuario puede editar solo sus figuritas.
- Cada usuario puede crear eventos propios.
- Cada usuario puede editar solo eventos creados por el.

## Resultado esperado

Firestore queda listo para un MVP publico con permisos razonables.

## Criterio de cierre

- Las reglas bloquean modificaciones de otros usuarios.
- Las pantallas siguen funcionando con reglas activas.
- No hay colecciones sensibles abiertas a escritura publica.

---

# Fase 8: Ads y Analytics

## Objetivo

Agregar medicion y monetizacion ligera sin afectar la UX principal.

## Tareas

- Integrar Firebase Analytics.
- Definir eventos importantes de producto.
- Integrar Google AdMob.
- Agregar banner discreto.
- Evaluar interstitial ocasional.
- Evitar anuncios invasivos en el flujo del album.

## Eventos sugeridos

- Login completado.
- Figurita marcada como obtenida.
- Figurita marcada como repetida.
- Match abierto.
- Evento creado.

## Resultado esperado

La app mide uso basico y tiene monetizacion inicial discreta.

## Criterio de cierre

- Analytics recibe eventos.
- AdMob renderiza anuncios en ubicaciones no invasivas.
- La experiencia principal no se siente interrumpida.

---

# Fase 9: Performance y Pulido

## Objetivo

Asegurar que el MVP sea rapido, estable y agradable de usar.

## Tareas

- Revisar renders del album.
- Optimizar listas y paginas.
- Evitar renders innecesarios en `StickerCard`.
- Revisar queries Firestore.
- Agregar skeletons o estados de carga.
- Ajustar microanimaciones.
- Probar en Android real.
- Probar vista web si se publica en Firebase Hosting.

## Resultado esperado

La app se siente instantanea en las acciones principales.

## Criterio de cierre

- Las interacciones del album responden sin retrasos visibles.
- No hay pantallas con cargas confusas.
- No hay errores criticos en dispositivo real.

---

# Fase 10: Publicacion MVP

## Objetivo

Preparar y publicar una primera version usable.

## Tareas

- Configurar EAS Build.
- Preparar build Android.
- Configurar Firebase Hosting para web si aplica.
- Preparar icono y splash screen.
- Revisar permisos de la app.
- Preparar metadata para tienda.
- Ejecutar prueba final end-to-end.
- Publicar beta interna o release inicial.

## Resultado esperado

El MVP queda disponible para usuarios reales o testers.

## Criterio de cierre

- Build Android generado correctamente.
- Web deploy funcionando si aplica.
- Flujo principal probado: login, marcar figuritas, ver matches, ver eventos.

---

# Fuera del MVP

Estas funciones deben quedar documentadas, pero no implementarse en la primera version.

- OCR de figuritas individuales.
- OCR de paginas completas.
- Premium.
- Favoritos.
- Estadisticas avanzadas.
- Filtros avanzados.
- Recomendaciones inteligentes.

---

# Orden Recomendado de Ejecucion

1. Construir album local excelente.
2. Agregar autenticacion.
3. Persistir datos en Firestore.
4. Implementar matching basico.
5. Implementar eventos.
6. Agregar seguridad.
7. Agregar analytics y ads.
8. Pulir performance.
9. Publicar MVP.

---

# Definicion de MVP Terminado

El MVP se considera terminado cuando un usuario puede:

- Iniciar sesion con Google.
- Ver su album.
- Marcar figuritas obtenidas, repetidas y faltantes.
- Guardar su progreso.
- Encontrar matches simples de intercambio.
- Ver eventos cercanos.
- Crear un evento propio.
- Usar la app sin friccion ni cargas lentas.
