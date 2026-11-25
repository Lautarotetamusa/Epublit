#!/usr/bin/env python3
"""Genera ATRIBUCIONES.md a partir de catalogo.json y fotos.json."""

import json
from collections import defaultdict
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
ANIO = 2026


def main() -> None:
    catalogo = json.loads((BASE / "catalogo.json").read_text(encoding="utf-8"))
    fotos = json.loads((BASE / "fotos.json").read_text(encoding="utf-8"))
    personas = {p["slug"]: p for p in catalogo["personas"]}
    colecciones = {c["slug"]: c for c in catalogo["colecciones"]}

    por_coleccion = defaultdict(int)
    for libro in catalogo["libros"]:
        por_coleccion[libro["coleccion"]] += 1

    participaciones = defaultdict(list)
    for libro in catalogo["libros"]:
        for relacion in libro["personas"]:
            participaciones[relacion["persona"]].append((libro["titulo"], relacion["rol"]))

    lineas = [
        "# Atribuciones y licencias — catálogo demo",
        "",
        "Este documento explica de dónde sale cada dato y cada imagen del catálogo. La regla de la demo es simple: **obras en dominio público, ediciones propias, operación ficticia**.",
        "",
        "## 1. Criterio general",
        "",
        "- **Obras:** autores fallecidos antes de 1956. En Argentina el derecho de autor dura la vida del autor más 70 años, contados desde el 1 de enero del año siguiente a la muerte (Ley 11.723, art. 5).",
        "- **Sinopsis, biografías y descripciones de colecciones:** escritas para esta demo. No se copiaron contratapas, prólogos ni textos de Wikipedia.",
        "- **Portadas:** diseño propio, generado con el sistema tipográfico de Epublit. No se usaron tapas de ediciones comerciales.",
        "- **Fotos de autores:** Wikimedia Commons. Cada ficha indica licencia, crédito y enlace al archivo original.",
        "- **ISBN:** sintéticos, con dígito verificador válido y prefijo 978-987-9999. No corresponden a ediciones reales.",
        "- **Datos de gestión** (clientes, ventas, movimientos, liquidaciones): ficticios. No se usan DNI, CUIT, direcciones ni correos de personas reales.",
        "",
        f"Catálogo actual: **{len(catalogo['libros'])} libros**, **{len(catalogo['personas'])} personas** y **{len(catalogo['colecciones'])} colecciones**.",
        "",
        "## 2. Obras por colección",
        "",
        "| Colección | Libros |",
        "|---|---:|",
    ]
    for slug, cantidad in por_coleccion.items():
        lineas.append(f"| {colecciones[slug]['titulo']} | {cantidad} |")

    lineas += [
        "",
        "## 3. Dominio público",
        "",
        "La fecha de entrada al dominio público se calcula como año de muerte + 71, es decir, el 1 de enero del año siguiente al cumplimiento de los 70 años. Todos los autores del catálogo están en dominio público en Argentina desde antes de 2026.",
        "",
        "| Autor | Nac. | Muerte | Dominio público desde | Obras en el catálogo |",
        "|---|---:|---:|---:|---|",
    ]

    autores = [p for p in catalogo["personas"] if not p["ficticio"] and p["datos"]["muerte"]]
    autores.sort(key=lambda p: (p["datos"]["muerte"], p["nombre"]))
    for persona in autores:
        obras = [titulo for titulo, rol in participaciones.get(persona["slug"], []) if rol == "Autor"]
        if not obras:
            continue
        lineas.append(
            f"| {persona['nombre']} | {persona['datos']['nacimiento']} | "
            f"{persona['datos']['muerte']} | {persona['datos']['muerte'] + 71} | "
            f"{'; '.join(obras)} |"
        )

    ficcionales = [p for p in catalogo["personas"] if p["ficticio"]]
    if ficcionales:
        lineas += [
            "",
            "### Colaboradores ficticios",
            "",
            "Estos perfiles existen sólo para mostrar los roles de la cuenta demo. No corresponden a personas reales.",
            "",
            "| Persona | Rol | Libros |",
            "|---|---|---|",
        ]
        for persona in ficcionales:
            libros = [f"{titulo} ({rol})" for titulo, rol in participaciones.get(persona["slug"], [])]
            lineas.append(f"| {persona['nombre']} | {persona['datos']['ocupacion']} | {'; '.join(libros)} |")

    lineas += [
        "",
        "## 4. Fotos de autores",
        "",
        "Todas las imágenes se descargaron de Wikimedia Commons, se redimensionaron y se guardaron en `imagenes/personas/`. Las licencias `CC BY` y `CC BY-SA` requieren atribución: el crédito de la tabla debe acompañar a la foto si se publica fuera de la demo.",
        "",
        "Si la demo es pública, conviene agregar un enlace **Atribuciones** en el pie de la app con esta tabla: la ficha de persona no muestra el crédito por sí sola. Las fotos con `CC BY-SA` se distribuyen bajo la misma licencia.",
        "",
        "| Persona | Licencia | Crédito | Fuente |",
        "|---|---|---|---|",
    ]
    for foto in sorted(fotos, key=lambda f: f["nombre"]):
        lineas.append(
            f"| {foto['nombre']} | {foto['licencia']} | {foto['credito']} | "
            f"[Commons]({foto['fuente']}) |"
        )

    lineas += [
        "",
        "## 5. Tipografías",
        "",
        "Las portadas usan Spectral, Manrope y JetBrains Mono, distribuidas bajo SIL Open Font License 1.1. Los archivos están en `scripts/tipografias/` y los textos de licencia en `scripts/tipografias/OFL-*.txt`.",
        "",
        "- Spectral: https://github.com/googlefonts/spectral",
        "- Manrope: https://github.com/sharanda/manrope",
        "- JetBrains Mono: https://github.com/JetBrains/JetBrainsMono",
        "",
        "## 6. Metadatos",
        "",
        "Los datos bibliográficos (título, autor, año, nacionalidad, fecha de muerte) se contrastaron con Wikidata (CC0), Project Gutenberg y Open Library. Los hechos bibliográficos no están protegidos por derecho de autor; las sinopsis y biografías de este catálogo son propias.",
        "",
        "No se usaron: tapas de ediciones comerciales, textos de contratapa, prólogos ajenos, traducciones protegidas ni párrafos de Wikipedia.",
        "",
        "## 7. Pendientes antes de publicar",
        "",
        "- Validar el criterio de dominio público con un abogado si la demo va a quedar pública de forma permanente.",
        "- Reemplazar los enlaces de reseñas de Wikipedia por reseñas propias o del sello.",
        "- Revisar que las fotos sigan disponibles en Commons y con la misma licencia.",
        "- Si se agregan obras extranjeras, verificar también la traducción: un original en dominio público no implica una traducción en dominio público.",
        "",
    ]

    (BASE / "ATRIBUCIONES.md").write_text("\n".join(lineas), encoding="utf-8")
    print(f"Escrito: {BASE / 'ATRIBUCIONES.md'}")


if __name__ == "__main__":
    main()
