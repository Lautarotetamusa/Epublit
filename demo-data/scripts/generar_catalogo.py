#!/usr/bin/env python3
"""Genera catalogo.json a partir de las fuentes JSON de ../fuentes.

Las fuentes editables son personas.json, colecciones.json, libros.json,
roles.json, resenas.json y stock_inicial.json. Los ISBN son sintéticos y
válidos; los precios, medidas y pesos son valores de demo, no de una edición
real.
"""

import json
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
FUENTES = BASE / "fuentes"


def cargar(nombre: str, clave: str):
    return json.loads((FUENTES / nombre).read_text(encoding="utf-8"))[clave]


PERSONAS = cargar("personas.json", "personas")
COLECCIONES = cargar("colecciones.json", "colecciones")
LIBROS = cargar("libros.json", "libros")
ROLES = cargar("roles.json", "roles")
RESENAS = cargar("resenas.json", "resenas")
STOCK = cargar("stock_inicial.json", "stock_inicial")


def isbn13(secuencia: int) -> str:
    """EAN-13 con prefijo editorial sintético 978-987-9999."""
    base = f"9789879999{secuencia:02d}"
    assert len(base) == 12, base
    suma = sum(int(d) * (1 if i % 2 == 0 else 3) for i, d in enumerate(base))
    check = (10 - suma % 10) % 10
    return f"{base}{check}"


def precio_por_paginas(paginas: int) -> int:
    if paginas <= 128:
        return 14900
    if paginas <= 192:
        return 17900
    if paginas <= 256:
        return 19900
    if paginas <= 320:
        return 22900
    if paginas <= 432:
        return 26900
    if paginas <= 624:
        return 32900
    if paginas <= 799:
        return 36900
    return 44900


def medidas(libro: dict) -> tuple[float, float, float, float]:
    paginas = libro["paginas"]
    infantil = libro["coleccion"] == "infantil-y-juvenil"
    if infantil and libro["slug"] == "fabulas-de-samaniego":
        return 24.0, 20.0, 1.8, 0.42
    if infantil:
        largo = round(0.3 + paginas * 0.0045, 2)
        peso = round(0.12 + paginas * 0.00065 + 0.03, 3)
        return 22.0, 15.0, largo, peso
    if paginas >= 500:
        alto, ancho = 23.0, 15.0
    else:
        alto, ancho = 21.0, 14.0
    largo = round(0.35 + paginas * 0.0055, 2)
    peso = round(0.12 + paginas * 0.00075, 3)
    return alto, ancho, largo, peso


def persona_publica(persona: dict, indice: int) -> dict:
    return {
        "slug": persona["slug"],
        "nombre": persona["nombre"],
        "dni": f"9{indice:07d}",
        "email": f"{persona['slug']}@autores.epublit.test",
        "bio": persona["bio"],
        "foto": None,
        "foto_fuente": None,
        "foto_licencia": None,
        "foto_credito": None,
        "ficticio": persona.get("ficticio", False),
        "wiki": persona.get("wiki"),
        "datos": {
            "nacimiento": persona.get("nacimiento"),
            "muerte": persona.get("muerte"),
            "nacionalidad": persona.get("nacionalidad"),
            "ocupacion": persona.get("ocupacion"),
        },
    }


def main() -> None:
    personas = {p["slug"]: p for p in PERSONAS}
    colecciones = {c["slug"]: c for c in COLECCIONES}
    numeros = {slug: 0 for slug in colecciones}

    salida_personas = [persona_publica(p, i + 1) for i, p in enumerate(PERSONAS)]

    # Si ya se corrieron las descargas, conservar los retratos y sus licencias
    # al regenerar el catálogo.
    fotos_path = BASE / "fotos.json"
    if fotos_path.exists():
        fotos = {f["persona"]: f for f in json.loads(fotos_path.read_text(encoding="utf-8"))}
        for persona in salida_personas:
            foto = fotos.get(persona["slug"])
            # Si la imagen no está descargada (por ejemplo, en un clon donde
            # imagenes/ está ignorado), no referenciar un archivo inexistente.
            if foto and (BASE / foto["archivo"]).exists():
                persona.update({
                    "foto": foto["archivo"],
                    "foto_fuente": foto["fuente"],
                    "foto_licencia": foto["licencia"],
                    "foto_credito": foto["credito"],
                })

    salida_libros = []

    for i, libro in enumerate(LIBROS, start=1):
        numeros[libro["coleccion"]] += 1
        autor = personas[libro["autor"]]
        alto, ancho, largo, peso = medidas(libro)
        precio = libro.get("precio") or precio_por_paginas(libro["paginas"])
        edad_min, edad_max = libro.get("edad", (None, None))

        participantes = [
            {"persona": libro["autor"], "rol": "Autor", "porcentaje": 10}
        ]
        if libro.get("ilustrador"):
            participantes.append({"persona": libro["ilustrador"], "rol": "Ilustrador", "porcentaje": 4})
        if libro.get("prologo"):
            participantes.append({"persona": libro["prologo"], "rol": "Prólogo", "porcentaje": 2})

        creditos = []
        if libro.get("ilustrador"):
            creditos.append(f"Ilustraciones: {personas[libro['ilustrador']]['nombre']}")
        if libro.get("prologo"):
            creditos.append(f"Prólogo: {personas[libro['prologo']]['nombre']}")

        salida_libros.append({
            "slug": libro["slug"],
            "titulo": libro["titulo"],
            "fecha_edicion": libro["fecha"],
            "precio": precio,
            "paginas": libro["paginas"],
            "alto": alto,
            "ancho": ancho,
            "largo": largo,
            "peso_kg": peso,
            "edad_min": edad_min,
            "edad_max": edad_max,
            "tipo_edicion": libro.get("tipo_edicion", "normal"),
            "visible": True,
            "stock_negativo_permitido": 0,
            "stock_inicial": STOCK.get(libro["slug"], 8 + (i * 7) % 33),
            "brief": libro["brief"],
            "coleccion": libro["coleccion"],
            "numero_en_coleccion": numeros[libro["coleccion"]],
            "kicker": libro["kicker"],
            "portada": f"imagenes/portadas/{libro['slug']}.jpg",
            "portada_credito": "Diseño propio para la demo de Epublit",
            "creditos": creditos,
            "personas": participantes,
            "obra": {
                "titulo_original": libro["titulo"],
                "anio_publicacion": libro["anio"],
                "genero": libro["genero"],
                "pais": autor.get("nacionalidad"),
                "autor_muerte": autor.get("muerte"),
                "dominio_publico": True,
                "entrada_dominio_publico": (autor["muerte"] + 71) if autor.get("muerte") else None,
            },
            "resenas": RESENAS.get(libro["slug"], []),
        })

    # Orden estable por colección y número, e ISBN correlativo en ese orden.
    orden = {slug: indice for indice, slug in enumerate(colecciones)}
    salida_libros.sort(key=lambda l: (orden[l["coleccion"]], l["numero_en_coleccion"]))
    for indice, libro in enumerate(salida_libros, start=1):
        libro["isbn"] = isbn13(indice)

    catalogo = {
        "meta": {
            "version": "1.0",
            "generado": "2026-11-25",
            "moneda": "ARS",
            "descripcion": "Catálogo de demostración de Epublit: obras en dominio público en ediciones ficticias del sello demo.",
            "criterio_dominio_publico": "Ley 11.723 (Argentina), art. 5: vida del autor más 70 años contados desde el 1 de enero del año siguiente a la muerte. Todos los autores del catálogo murieron antes de 1956.",
            "isbn_nota": "ISBN-13 sintéticos con prefijo 978-987-9999 y dígito verificador válido. No corresponden a ninguna edición comercial.",
            "sinopsis_nota": "Sinopsis y biografías escritas para esta demo. No reproducen contratapas, prólogos ni textos de Wikipedia.",
            "imagenes_nota": "Portadas diseñadas para la demo. Fotos de autores: Wikimedia Commons, con licencia indicada en cada ficha.",
            "resenas_nota": "Los enlaces de reseñas apuntan a artículos de referencia de Wikipedia; reemplazar por reseñas propias antes de publicar.",
            "totales": {
                "libros": len(salida_libros),
                "personas": len(salida_personas),
                "colecciones": len(COLECCIONES),
            },
        },
        "roles": ROLES,
        "colecciones": [
            {**c, "portada": None} for c in COLECCIONES
        ],
        "personas": salida_personas,
        "libros": salida_libros,
    }

    validar(catalogo)

    (BASE / "catalogo.json").write_text(
        json.dumps(catalogo, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print(f"OK: {len(salida_libros)} libros, {len(salida_personas)} personas, {len(COLECCIONES)} colecciones")
    print(f"Escrito: {BASE / 'catalogo.json'}")


def validar(catalogo: dict) -> None:
    slugs_libros = [l["slug"] for l in catalogo["libros"]]
    isbns = [l["isbn"] for l in catalogo["libros"]]
    slugs_personas = {p["slug"] for p in catalogo["personas"]}
    slugs_colecciones = {c["slug"] for c in catalogo["colecciones"]}

    assert len(slugs_libros) == len(set(slugs_libros)), "slug de libro duplicado"
    assert len(isbns) == len(set(isbns)), "ISBN duplicado"
    for libro in catalogo["libros"]:
        assert len(libro["titulo"]) <= 60, f"título muy largo: {libro['titulo']}"
        assert libro["isbn"].isdigit() and len(libro["isbn"]) == 13, libro["isbn"]
        assert libro["coleccion"] in slugs_colecciones, libro["coleccion"]
        assert libro["precio"] > 0 and libro["paginas"] > 0
        assert all(p["persona"] in slugs_personas for p in libro["personas"]), libro["slug"]
        assert libro["obra"]["dominio_publico"] is True
        if libro["obra"]["autor_muerte"]:
            assert libro["obra"]["autor_muerte"] <= 1955, libro["slug"]
    for persona in catalogo["personas"]:
        assert len(persona["nombre"]) <= 60, persona["nombre"]
        assert len(persona["email"]) <= 60, persona["email"]
        assert len(persona["dni"]) == 8, persona["dni"]


if __name__ == "__main__":
    main()
