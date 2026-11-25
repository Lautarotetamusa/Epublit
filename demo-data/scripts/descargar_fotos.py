#!/usr/bin/env python3
"""Descarga retratos de autores desde Wikimedia Commons y actualiza catalogo.json.

Sólo acepta archivos con licencia de dominio público, CC0 o CC BY / CC BY-SA.
Si la imagen de la ficha de Wikipedia no está en Commons (posible fair use),
la deja en null. Guarda la fuente, la licencia y el crédito en cada persona.
"""

import html
import json
import re
import subprocess
import time
import urllib.parse
import urllib.request
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
USER_AGENT = "EpublitDemo/1.0 (demo@epublit.test) python-urllib"
API = "https://commons.wikimedia.org/w/api.php"
WIKI = "https://es.wikipedia.org/w/api.php"
LICENCIAS_OK = ("public domain", "pd-", "cc0", "cc by", "pd ")
LICENCIAS_NO = ("fair use", "non-free", "copyright")

# Créditos normalizados: el campo Artist de Commons suele traer HTML, "[1]"
# o el nombre repetido. Para la demo preferimos una línea legible.
CREDITOS = json.loads(
    (BASE / "fuentes" / "creditos_fotos.json").read_text(encoding="utf-8")
)["creditos"]


def pedir(url: str) -> dict:
    # curl en vez de urllib: en este entorno urllib se cuelga por IPv6.
    salida = subprocess.run(
        ["curl", "-sS", "--max-time", "25", "-A", USER_AGENT, url],
        capture_output=True, check=True,
    ).stdout
    return json.loads(salida.decode("utf-8"))


def limpiar_html(texto: str) -> str:
    texto = re.sub(r"<[^>]+>", "", texto or "")
    return " ".join(html.unescape(texto).split())


def imagen_de_wikipedia(titulo: str) -> dict | None:
    params = {
        "action": "query", "titles": titulo, "prop": "pageimages",
        "piprop": "original", "format": "json", "redirects": "1",
    }
    data = pedir(f"{WIKI}?{urllib.parse.urlencode(params)}")
    paginas = data.get("query", {}).get("pages", {})
    for pagina in paginas.values():
        original = pagina.get("original")
        if original and "/wikipedia/commons/" in original.get("source", ""):
            return original
    return None


def info_commons(nombre_archivo: str) -> dict | None:
    params = {
        "action": "query", "titles": f"File:{nombre_archivo}",
        "prop": "imageinfo", "iiprop": "url|extmetadata",
        "iiurlwidth": "900", "format": "json",
    }
    data = pedir(f"{API}?{urllib.parse.urlencode(params)}")
    for pagina in data.get("query", {}).get("pages", {}).values():
        infos = pagina.get("imageinfo")
        if not infos:
            continue
        info = infos[0]
        meta = info.get("extmetadata", {})
        licencia = limpiar_html(meta.get("LicenseShortName", {}).get("value", ""))
        if not licencia:
            licencia = limpiar_html(meta.get("UsageTerms", {}).get("value", ""))
        credit = limpiar_html(
            meta.get("Artist", {}).get("value", "")
            or meta.get("Credit", {}).get("value", "")
            or "Autor desconocido"
        )
        return {
            "thumburl": info.get("thumburl") or info.get("url"),
            "descriptionurl": info.get("descriptionurl"),
            "licencia": licencia,
            "credito": credit,
        }
    return None


def licencia_aceptada(licencia: str) -> bool:
    valor = (licencia or "").lower()
    if any(x in valor for x in LICENCIAS_NO):
        return False
    return any(x in valor for x in LICENCIAS_OK)


def descargar(url: str, destino: Path) -> None:
    temporal = destino.with_suffix(".tmp")
    subprocess.run(
        ["curl", "-sSL", "--max-time", "60", "-A", USER_AGENT, "-o", str(temporal), url],
        check=True,
    )
    subprocess.run([
        "magick", str(temporal), "-auto-orient", "-resize", "900x1100>",
        "-quality", "88", str(destino),
    ], check=True)
    temporal.unlink(missing_ok=True)


def main() -> None:
    ruta = BASE / "catalogo.json"
    catalogo = json.loads(ruta.read_text(encoding="utf-8"))
    carpeta = BASE / "imagenes" / "personas"
    carpeta.mkdir(parents=True, exist_ok=True)
    manifiesto_path = BASE / "fotos.json"
    existentes = {}
    if manifiesto_path.exists():
        existentes = {
            f["persona"]: f
            for f in json.loads(manifiesto_path.read_text(encoding="utf-8"))
        }
    manifiesto = dict(existentes)

    for persona in catalogo["personas"]:
        if persona.get("ficticio") or not persona.get("wiki"):
            continue

        slug = persona["slug"]
        if slug in manifiesto and (BASE / manifiesto[slug]["archivo"]).exists():
            persona.update({
                "foto": manifiesto[slug]["archivo"],
                "foto_fuente": manifiesto[slug]["fuente"],
                "foto_licencia": manifiesto[slug]["licencia"],
                "foto_credito": manifiesto[slug]["credito"],
            })
            print(f"· {persona['nombre']} (ya descargada)")
            continue

        print(f"· {persona['nombre']}", end=" ", flush=True)
        try:
            original = imagen_de_wikipedia(persona["wiki"])
            if not original:
                print("sin imagen en Commons")
                continue

            nombre = urllib.parse.unquote(
                original["source"].split("/")[-1].split("?")[0]
            )
            info = info_commons(nombre)
            if not info:
                print("sin metadatos")
                continue
            if not licencia_aceptada(info["licencia"]):
                print(f"licencia no aceptada: {info['licencia']}")
                continue

            destino = carpeta / f"{slug}.jpg"
            descargar(info["thumburl"], destino)
            persona["foto"] = f"imagenes/personas/{slug}.jpg"
            persona["foto_fuente"] = info["descriptionurl"]
            persona["foto_licencia"] = info["licencia"]
            persona["foto_credito"] = CREDITOS.get(slug, info["credito"])
            manifiesto[slug] = {
                "persona": slug,
                "nombre": persona["nombre"],
                "archivo": persona["foto"],
                "fuente": info["descriptionurl"],
                "licencia": info["licencia"],
                "credito": CREDITOS.get(slug, info["credito"]),
            }
            print(f"ok ({info['licencia']})")
        except Exception as error:  # red o API: seguir con el resto
            print(f"error: {error}")

        ruta.write_text(json.dumps(catalogo, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        time.sleep(0.4)

    ruta.write_text(json.dumps(catalogo, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (BASE / "fotos.json").write_text(
        json.dumps(list(manifiesto.values()), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"\n{len(manifiesto)} retratos en el manifiesto de {len(catalogo['personas'])} personas")


if __name__ == "__main__":
    main()
