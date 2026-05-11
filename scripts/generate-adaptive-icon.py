#!/usr/bin/env python3
"""
Regenera app/assets/adaptive-icon.png desde app/assets/logo.png con padding
seguro para Android adaptive icons.

Android aplica una mascara (circulo, squircle, etc) que recorta los bordes.
La zona segura es el 66% central del canvas. Cualquier contenido fuera
de ese cuadrante se puede ver recortado en algunos launchers.

Salida: PNG 1024x1024 RGBA transparente con el logo escalado a ~676x676
centrado. El backgroundColor de adaptiveIcon se ve detras.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "app" / "assets" / "logo.png"
DST = ROOT / "app" / "assets" / "adaptive-icon.png"

CANVAS = 1024
SAFE_RATIO = 0.66
INNER = int(CANVAS * SAFE_RATIO)  # 675
OFFSET = (CANVAS - INNER) // 2     # ~174

# Tolerancia para floodfill del fondo negro -> alpha 0.
# El logo tiene fondo casi puro (#000 o muy cercano).
BG_TOLERANCE = 18  # 0..255 por canal


def remove_dark_background(img: Image.Image) -> Image.Image:
    """Convierte pixeles cercanos a negro en transparentes."""
    img = img.convert("RGBA")
    pixels = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if r <= BG_TOLERANCE and g <= BG_TOLERANCE and b <= BG_TOLERANCE:
                pixels[x, y] = (0, 0, 0, 0)
    return img


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"No existe {SRC}")

    src = Image.open(SRC).convert("RGBA")
    print(f"Cargado {SRC.name} {src.size}")

    transparent = remove_dark_background(src)

    # Crop al bounding box del contenido opaco para evitar margen muerto
    bbox = transparent.getbbox()
    if bbox:
        transparent = transparent.crop(bbox)
        print(f"Crop bbox {bbox} -> {transparent.size}")

    # Escalar manteniendo aspect ratio, fit a INNER x INNER
    transparent.thumbnail((INNER, INNER), Image.LANCZOS)
    print(f"Escalado a {transparent.size}")

    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    cx = (CANVAS - transparent.width) // 2
    cy = (CANVAS - transparent.height) // 2
    canvas.paste(transparent, (cx, cy), transparent)
    print(f"Pegado en offset ({cx},{cy})")

    DST.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(DST, "PNG", optimize=True)
    print(f"Escrito {DST} ({DST.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
