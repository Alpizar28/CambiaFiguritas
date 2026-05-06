# Arquitectura — App de Figuritas Mundial

## Objetivo

Aplicación multiplataforma para:
- llevar control del álbum del mundial
- registrar figuritas repetidas/faltantes
- encontrar matches de intercambio
- descubrir eventos cercanos
- monetizar con anuncios ligeros

Enfoque:
- UX extremadamente rápida
- diseño minimalista
- visual moderno
- sin depender de assets oficiales protegidos
- MVP publicable rápido

---

# Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React Native |
| Framework | Expo |
| Lenguaje | TypeScript |
| Estado global | Zustand |
| Backend | Firebase |
| Database | Firestore |
| Auth | Firebase Auth |
| Hosting Web | Firebase Hosting |
| Analytics | Firebase Analytics |
| Ads | Google AdMob |
| Mapas | Google Maps |
| OCR futuro | VPS propio |

---

# Arquitectura General

```txt
                 ┌────────────────┐
                 │ React Native   │
                 │ Expo           │
                 └───────┬────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
   Android App                      Web App
   Play Store                    Firebase Hosting
         │                               │
         └───────────────┬───────────────┘
                         │
                    Firebase SDK
                         │
     ┌───────────────────┼───────────────────┐
     │                   │                   │
 Firestore         Firebase Auth      Firebase Storage
     │
 Albums
 Users
 Matches
 Events

```

---

# Filosofía UX

## Objetivo principal

La app debe sentirse:
- instantánea
- visual
- cómoda con una mano
- sin fricción

El usuario NO debería:
- escribir mucho
- navegar menús complejos
- esperar cargas largas

---

# Concepto Visual

## Inspiración

No copiar el álbum oficial.

En lugar de eso:
- usar tarjetas minimalistas
- grids modernos
- placeholders abstractos
- diseño editorial/deportivo
- formas geométricas limpias

---

# Dirección de Diseño

## Estilo

Minimalismo deportivo moderno.

Características:
- mucho espacio negativo
- tipografía limpia
- bordes suaves
- microanimaciones rápidas
- colores neutros + acentos fuertes
- sombras suaves
- layouts ordenados

---

# Paleta recomendada

## Base

```txt
Background: #0F1115
Surface: #171A21
Card: #1D212B
Border: #2A3140
```

## Acentos

```txt
Primary: #6EE7B7
Secondary: #60A5FA
Warning: #FBBF24
Danger: #F87171
```

---

# Estados de Figuritas

| Estado | Visual |
|---|---|
| Faltante | gris oscuro |
| Obtenida | verde suave |
| Repetida | azul |
| Especial | dorado suave |

---

# Navegación

## Bottom Tabs

```txt
[ Álbum ]
[ Matches ]
[ Eventos ]
[ Perfil ]
```

Máximo 4 tabs.

Nada más.

---

# Pantallas Principales

## 1. Álbum

Pantalla principal.

Funciones:
- páginas visuales
- tap rápido
- progreso
- filtros
- búsqueda

---

## 2. Matches

Mostrar:
- usuarios cercanos
- figuritas compatibles
- score de intercambio
- botón WhatsApp

---

## 3. Eventos

Mapa simple:
- intercambios
- meetups
- tiendas

---

## 4. Perfil

Mostrar:
- progreso
- repetidas
- estadísticas
- configuración

---

# Sistema de Álbum

## Renderizado

Cada página se define mediante JSON.

Ejemplo:

```json
{
  "page": 1,
  "stickers": [
    {
      "number": 1,
      "x": 20,
      "y": 40,
      "width": 60,
      "height": 80
    }
  ]
}
```

---

# Interacciones UX

| Acción | Resultado |
|---|---|
| Tap | obtenida |
| Doble tap | repetida |
| Long press | detalles |
| Swipe horizontal | cambiar página |

---

# Animaciones

## Reglas

Animaciones:
- rápidas
- suaves
- cortas
- útiles

NO:
- animaciones pesadas
- exceso de efectos
- transiciones lentas

---

# Componentes Principales

## StickerCard

Responsabilidad:
- renderizar figurita
- manejar estado
- manejar interacciones

Estados:
- empty
- owned
- repeated
- special

---

## AlbumPage

Responsabilidad:
- renderizar grid
- zoom
- scroll
- virtualización

---

## MatchCard

Mostrar:
- avatar
- cantidad de matches
- distancia
- botón contacto

---

# Arquitectura Frontend

```txt
src/
│
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

---

# Features

```txt
features/
│
├── auth/
├── album/
├── matching/
├── events/
├── profile/
└── ads/
```

---

# Estado Global

Usar Zustand.

Separar:

```txt
albumStore
matchStore
userStore
uiStore
```

---

# Firestore

## users

```json
{
  "name": "",
  "photoUrl": "",
  "city": "",
  "premium": false,
  "createdAt": ""
}
```

---

## stickers

```json
{
  "number": 123,
  "page": 12,
  "team": "Argentina",
  "rarity": "normal"
}
```

---

## user_stickers

```json
{
  "userId": "",
  "stickerId": "",
  "status": "owned"
}
```

Estados:

```txt
missing
owned
repeated
```

---

## events

```json
{
  "title": "",
  "lat": 0,
  "lng": 0,
  "date": "",
  "createdBy": ""
}
```

---

# Matching

## MVP

Lógica simple:

```txt
A necesita X
B tiene repetida X
```

---

# OCR Futuro

NO implementar en MVP.

Arquitectura futura:

```txt
App
 ↓
VPS OCR API
 ↓
OpenCV / Tesseract
 ↓
Resultados JSON
```

---

# Ads

## Estrategia

Mantener anuncios discretos.

### Permitidos
- banner pequeño
- interstitial ocasional

### Evitar
- videos constantes
- ads agresivos
- popups invasivos

---

# Performance

## Importante

Optimizar:
- renders
- imágenes
- listas
- queries Firestore

---

# Reglas Técnicas

## Frontend

- TypeScript obligatorio
- componentes pequeños
- evitar lógica gigante
- usar hooks reutilizables
- separar UI y lógica

---

# Seguridad

## Firestore Rules

Cada usuario solo puede:
- editar sus datos
- editar sus figuritas
- crear eventos propios

---

# Roadmap

## V1

- login Google
- álbum visual
- repetidas/faltantes
- matching básico
- eventos
- AdMob

---

## V2

- OCR figuritas individuales
- estadísticas
- favoritos
- filtros avanzados

---

## V3

- OCR páginas completas
- premium
- recomendaciones inteligentes

---

# Objetivo Final UX

La app debe sentirse como:
- una mezcla entre álbum físico y app moderna
- extremadamente rápida
- visualmente limpia
- enfocada en interacción social
- sin complejidad innecesaria
