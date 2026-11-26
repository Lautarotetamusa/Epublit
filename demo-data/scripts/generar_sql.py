#!/usr/bin/env python3
"""Genera cargar_demo.sql, limpiar_demo.sql y la carpeta files/demo.

Fuente de verdad: catalogo.json, movimientos.json, ventas.json,
liquidaciones.json y tienda.json (generados) más cuenta.json, clientes.json y
contenido.json (editados a mano en fuentes/). Los IDs son fijos y altos
(9.000.001+) para que el SQL sea legible; al final se ajustan las secuencias.
"""

import json
import shutil
from datetime import date, datetime, timedelta
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
FUENTES = BASE / "fuentes"
SQL_DIR = BASE / "sql"
FILES_DIR = BASE / "files" / "demo"
PARAMETROS = json.loads((FUENTES / "parametros.json").read_text(encoding="utf-8"))
COMISIONES = PARAMETROS["comisiones"]
FECHAS_INICIALES = PARAMETROS["fechas_iniciales"]
MEDIOS = PARAMETROS["medios"]

CATALOGO = json.loads((BASE / "catalogo.json").read_text(encoding="utf-8"))
CUENTA = json.loads((FUENTES / "cuenta.json").read_text(encoding="utf-8"))
CLIENTES_JSON = json.loads((FUENTES / "clientes.json").read_text(encoding="utf-8"))
CLIENTES = CLIENTES_JSON["clientes"]
ESPECIALES = {c["slug"]: c for c in CLIENTES_JSON["especiales"]}
MOVIMIENTOS = json.loads((BASE / "movimientos.json").read_text(encoding="utf-8"))["movimientos"]
VENTAS = json.loads((BASE / "ventas.json").read_text(encoding="utf-8"))["ventas"]
LIQUIDACIONES_JSON = json.loads((BASE / "liquidaciones.json").read_text(encoding="utf-8"))
TIENDA = json.loads((BASE / "tienda.json").read_text(encoding="utf-8"))
CONTENIDO = json.loads((FUENTES / "contenido.json").read_text(encoding="utf-8"))
FECHA_INICIO = "/".join(reversed(CUENTA["fecha_inicio"].split("-")))

USER_ID = 9_000_001
ROLE_IDS = {"Autor": 9_000_001, "Ilustrador": 9_000_002, "Prólogo": 9_000_003}
TIPO_EDICION_NOMBRE = {"normal": "Normal", "pop_up": "Pop up", "cartone": "Cartoné"}
TIPO_EDICION_IDS = {nombre: 9_000_001 + i for i, nombre in enumerate(("Normal", "Pop up", "Cartoné"))}
MEDIO_IDS = {nombre: 9_000_001 + i for i, nombre in enumerate(MEDIOS)}
DEPOSITO_PRINCIPAL = 9_000_001
DEPOSITO_CONSUMIDOR = ESPECIALES["consumidor-final"]["deposito_id"]
DEPOSITO_MOSTRADOR = ESPECIALES["mostrador"]["deposito_id"]
CLIENTE_CONSUMIDOR = ESPECIALES["consumidor-final"]["id"]
CLIENTE_MOSTRADOR = ESPECIALES["mostrador"]["id"]

COLECCION_ID = {c["slug"]: 9_000_001 + i for i, c in enumerate(CATALOGO["colecciones"])}
PERSONA_ID = {p["slug"]: 9_000_001 + i for i, p in enumerate(CATALOGO["personas"])}
LIBRO_ID = {l["slug"]: 9_000_001 + i for i, l in enumerate(CATALOGO["libros"])}
LIBRO_POR_SLUG = {l["slug"]: l for l in CATALOGO["libros"]}
LIBRO_POR_ISBN = {l["isbn"]: l for l in CATALOGO["libros"]}
PERSONA_POR_SLUG = {p["slug"]: p for p in CATALOGO["personas"]}

CLIENTE_ID = {"consumidor-final": CLIENTE_CONSUMIDOR, "mostrador": CLIENTE_MOSTRADOR}
DEPOSITO_POR_CLAVE = {
    "principal": DEPOSITO_PRINCIPAL,
    "consumidor": DEPOSITO_CONSUMIDOR,
    "mostrador": DEPOSITO_MOSTRADOR,
}
CLIENTE_POR_DEPOSITO = {
    DEPOSITO_CONSUMIDOR: CLIENTE_CONSUMIDOR,
    DEPOSITO_MOSTRADOR: CLIENTE_MOSTRADOR,
}
for i, cliente in enumerate(CLIENTES):
    cliente["id"] = 9_000_101 + i
    cliente["deposito_id"] = 9_000_101 + i
    CLIENTE_ID[cliente["slug"]] = cliente["id"]
    DEPOSITO_POR_CLAVE[f"cliente:{cliente['slug']}"] = cliente["deposito_id"]
    CLIENTE_POR_DEPOSITO[cliente["deposito_id"]] = cliente["id"]
CLIENTE_POR_SLUG = {c["slug"]: c for c in CLIENTES}
CLIENTE_POR_SLUG.update(ESPECIALES)

ANTICIPOS = LIQUIDACIONES_JSON["anticipos"]
MONTO_ACORDADO = {
    (a["libro"], a["persona"], a["rol"]): a["monto"] for a in ANTICIPOS
}


def q(value) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def jsonb(value) -> str:
    return q(json.dumps(value, ensure_ascii=False)) + "::jsonb"


def columna(nombre: str) -> str:
    return '"user"' if nombre == "user" else nombre


def insert(tabla: str, columnas: list[str], filas: list[list[str]], override: bool = True) -> str:
    if not filas:
        return ""
    lista_columnas = ", ".join(columna(c) for c in columnas)
    valores = ",\n".join("    (" + ", ".join(fila) + ")" for fila in filas)
    clausula = " OVERRIDING SYSTEM VALUE" if override else ""
    return f"INSERT INTO {tabla} ({lista_columnas}){clausula} VALUES\n{valores};\n"


def fecha_mas_dias(valor: str, dias: int) -> str:
    return (datetime.fromisoformat(valor) + timedelta(days=dias)).isoformat(sep=" ")


def autor_de(libro: dict) -> str | None:
    for relacion in libro["personas"]:
        if relacion["rol"] == "Autor":
            return PERSONA_POR_SLUG[relacion["persona"]]["nombre"]
    return None


def emisor_snapshot() -> dict:
    return {
        "razonSocial": CUENTA["razon_social"],
        "cuit": CUENTA["cuit"],
        "condicionFiscal": CUENTA["cond_fiscal"],
        "domicilio": CUENTA["domicilio"],
        "ingresosBrutos": "S/N",
        "inicioActividades": FECHA_INICIO,
        "email": CUENTA["email"],
        "logoUrl": None,
    }


def receptor_snapshot(cliente: dict) -> dict:
    return {
        "razonSocial": cliente.get("razon_social") or cliente["nombre"],
        "cuit": cliente.get("cuit"),
        "documento": None,
        "condicionFiscal": cliente.get("cond_fiscal") or "Consumidor Final",
        "domicilio": cliente.get("domicilio") or "",
        "condicionVenta": "Cuenta corriente" if cliente.get("tipo") == "inscripto" else "Contado",
    }


def item_snapshot(linea: dict, descuento: int) -> dict:
    libro = LIBRO_POR_ISBN[linea["isbn"]]
    bruto = round(linea["cantidad"] * linea["precio"], 2)
    importe_descuento = round(bruto * descuento / 100, 2)
    return {
        "isbn": linea["isbn"],
        "titulo": libro["titulo"],
        "autor": autor_de(libro),
        "cantidad": linea["cantidad"],
        "precioUnitario": linea["precio"],
        "descuentoPorcentaje": descuento,
        "importeDescuento": importe_descuento,
        "subtotal": round(bruto - importe_descuento, 2),
    }


def main() -> None:
    SQL_DIR.mkdir(parents=True, exist_ok=True)
    if FILES_DIR.exists():
        shutil.rmtree(FILES_DIR)
    for sub in ("libros", "personas"):
        (FILES_DIR / sub).mkdir(parents=True, exist_ok=True)

    for libro in CATALOGO["libros"]:
        origen = BASE / libro["portada"]
        if not origen.exists():
            raise FileNotFoundError(
                f"Falta la portada {origen}. "
                "Corré ./generar_demo.sh --con-portadas (requiere chromium y magick)."
            )
        shutil.copyfile(origen, FILES_DIR / "libros" / f"{libro['isbn']}.jpg")
    for persona in CATALOGO["personas"]:
        if not persona.get("foto"):
            continue
        origen = BASE / persona["foto"]
        if not origen.exists():
            print(f"AVISO: falta la foto {origen}; se omite de files/demo.")
            continue
        shutil.copyfile(origen, FILES_DIR / "personas" / f"{persona['slug']}.jpg")

    lineas: list[str] = []
    lineas.append("-- Demo completa de Epublit. Generado desde los JSON de demo-data.")
    lineas.append("-- No editar a mano: corré scripts/generar_sql.py.")
    lineas.append("--")
    lineas.append("-- Requiere copiar files/demo al FILES_PATH del servidor")
    lineas.append("-- (por ejemplo, back/files/demo).")
    lineas.append("-- Usuario: demo · Password: demo12345")
    lineas.append("-- Si la cuenta demo ya existe, corré limpiar_demo.sql primero.")
    lineas.append("")
    lineas.append("SET client_encoding = 'UTF8';")
    lineas.append("")
    lineas.append("BEGIN;")
    lineas.append("")
    lineas.append("DO $$")
    lineas.append("BEGIN")
    lineas.append(f"    IF EXISTS (SELECT 1 FROM users WHERE username = {q(CUENTA['username'])}) THEN")
    lineas.append("        RAISE EXCEPTION 'La cuenta demo ya existe. Ejecutá limpiar_demo.sql antes de recargar.';")
    lineas.append("    END IF;")
    lineas.append("    IF EXISTS (SELECT 1 FROM users WHERE id = 9000001)")
    lineas.append("       OR EXISTS (SELECT 1 FROM libros WHERE id_libro BETWEEN 9000001 AND 9000062)")
    lineas.append("       OR EXISTS (SELECT 1 FROM personas WHERE id BETWEEN 9000001 AND 9000049) THEN")
    lineas.append("        RAISE EXCEPTION 'El rango de IDs 9.000.001+ ya está en uso por otra cuenta.';")
    lineas.append("    END IF;")
    lineas.append("END $$;")
    lineas.append("")

    # Cuenta y defaults
    lineas.append("-- Cuenta demo")
    lineas.append(insert("users", [
        "id", "username", "password", "cuit", "cond_fiscal", "razon_social",
        "domicilio", "production", "email", "ingresos_brutos", "fecha_inicio",
        "punto_venta", "email_confirmado", "username_interno",
    ], [[
        str(USER_ID), q(CUENTA["username"]), q(CUENTA["password_hash"]), q(CUENTA["cuit"]),
        q(CUENTA["cond_fiscal"]), q(CUENTA["razon_social"]),
        q(CUENTA["domicilio"]), "false", q(CUENTA["email"]),
        q(CUENTA["ingresos_brutos"]), q(FECHA_INICIO), q(CUENTA["punto_venta"]),
        "true", "false",
    ]]))

    lineas.append("-- Roles")
    lineas.append(insert("roles", ["id", "nombre", "user"], [
        [str(ROLE_IDS["Autor"]), q("Autor"), str(USER_ID)],
        [str(ROLE_IDS["Ilustrador"]), q("Ilustrador"), str(USER_ID)],
        [str(ROLE_IDS["Prólogo"]), q("Prólogo"), str(USER_ID)],
    ]))

    lineas.append("-- Tipos de edición")
    lineas.append(insert("tipos_edicion", ["id", "nombre", "user"], [
        [str(TIPO_EDICION_IDS[nombre]), q(nombre), str(USER_ID)] for nombre in ("Normal", "Pop up", "Cartoné")
    ]))

    lineas.append("-- Clientes por defecto")
    lineas.append(insert("clientes", [
        "id", "nombre", "email", "cuit", "cond_fiscal", "razon_social", "domicilio", "tipo", "user",
    ], [
        [str(c["id"]), q(c["nombre"]), q(c["email"]), q(c["cuit"]), q(c["cond_fiscal"]),
         q(c["razon_social"]), q(c["domicilio"]), q(c["tipo"]), str(USER_ID)]
        for c in (ESPECIALES["consumidor-final"], ESPECIALES["mostrador"])
    ]))

    lineas.append("-- Clientes de la demo")
    lineas.append(insert("clientes", [
        "id", "nombre", "email", "cuit", "cond_fiscal", "razon_social", "domicilio", "tipo", "user",
    ], [
        [str(c["id"]), q(c["nombre"]), q(c["email"]), q(c["cuit"]), q(c["cond_fiscal"]),
         q(c["razon_social"]), q(c["domicilio"]), q(c["tipo"]), str(USER_ID)]
        for c in CLIENTES
    ]))

    lineas.append("-- Depósitos principal y de clientes")
    filas_depositos = [
        [str(DEPOSITO_PRINCIPAL), q("Depósito principal"), "NULL", "true", "NULL", str(USER_ID)],
        [str(DEPOSITO_CONSUMIDOR), q(ESPECIALES["consumidor-final"]["nombre"]), "NULL", "false", str(CLIENTE_CONSUMIDOR), str(USER_ID)],
        [str(DEPOSITO_MOSTRADOR), q(ESPECIALES["mostrador"]["nombre"]), "NULL", "false", str(CLIENTE_MOSTRADOR), str(USER_ID)],
    ]
    for c in CLIENTES:
        filas_depositos.append([
            str(c["deposito_id"]), q(c["deposito"]), "NULL", "false", str(c["id"]), str(USER_ID)
        ])
    lineas.append(insert("depositos", ["id", "nombre", "descripcion", "principal", "id_cliente", "user"], filas_depositos))

    lineas.append("-- Medios de pago con comisión")
    lineas.append(insert("medios_pago", ["id", "nombre", "comision", "user"], [
        [str(MEDIO_IDS[n]), q(n), str(COMISIONES[n]), str(USER_ID)] for n in MEDIOS
    ]))

    lineas.append("-- Colecciones")
    lineas.append(insert("colecciones", ["id", "titulo", "descripcion", "portada_key", "user"], [
        [str(COLECCION_ID[c["slug"]]), q(c["titulo"]), q(c["descripcion"]), "NULL", str(USER_ID)]
        for c in CATALOGO["colecciones"]
    ]))

    lineas.append("-- Personas")
    filas_personas = []
    for persona in CATALOGO["personas"]:
        foto_key = f"demo/personas/{persona['slug']}.jpg" if persona.get("foto") else None
        filas_personas.append([
            str(PERSONA_ID[persona["slug"]]), q(persona["dni"]), q(persona["nombre"]),
            q(persona["email"]), q(persona["bio"]), q(foto_key), str(USER_ID),
        ])
    lineas.append(insert("personas", ["id", "dni", "nombre", "email", "bio", "foto_key", "user"], filas_personas))

    lineas.append("-- Libros")
    filas_libros = []
    for libro in CATALOGO["libros"]:
        portada_key = f"demo/libros/{libro['isbn']}.jpg"
        filas_libros.append([
            str(LIBRO_ID[libro["slug"]]), q(libro["isbn"]), q(libro["titulo"]),
            q(libro["fecha_edicion"]), str(libro["precio"]), "0",
            str(libro["alto"]), str(libro["ancho"]), str(libro["largo"]),
            str(libro["paginas"]), q(libro["brief"]),
            q(libro["edad_min"]) if libro["edad_min"] is not None else "NULL",
            q(libro["edad_max"]) if libro["edad_max"] is not None else "NULL",
            "NULL", q(portada_key), str(COLECCION_ID[libro["coleccion"]]),
            str(libro["stock_negativo_permitido"]), str(libro["peso_kg"]),
            str(TIPO_EDICION_IDS[TIPO_EDICION_NOMBRE[libro["tipo_edicion"]]]), q(libro["visible"]), str(USER_ID),
        ])
    lineas.append(insert("libros", [
        "id_libro", "isbn", "titulo", "fecha_edicion", "precio", "stock",
        "alto", "ancho", "largo", "paginas", "brief", "edad_min", "edad_max",
        "book_trailer_url", "portada_key", "coleccion_id",
        "stock_negativo_permitido", "peso_kg", "tipo_edicion_id", "visible", "user",
    ], filas_libros))

    lineas.append("-- Precio inicial en el historial")
    lineas.append(insert("precio_libros", ["id", "isbn", "precio", "created_at", "user", "id_libro"], [
        [str(9_000_001 + i), q(libro["isbn"]), str(libro["precio"]),
         q(f"{libro['fecha_edicion']} 12:00:00"), str(USER_ID), str(LIBRO_ID[libro["slug"]])]
        for i, libro in enumerate(CATALOGO["libros"])
    ]))

    lineas.append("-- Participaciones de personas en libros")
    filas_relaciones = []
    for libro in CATALOGO["libros"]:
        for relacion in libro["personas"]:
            monto = MONTO_ACORDADO.get((libro["slug"], relacion["persona"], relacion["rol"]))
            filas_relaciones.append([
                q(libro["isbn"]), str(PERSONA_ID[relacion["persona"]]),
                str(relacion["porcentaje"]), q(monto) if monto is not None else "NULL",
                str(ROLE_IDS[relacion["rol"]]), str(LIBRO_ID[libro["slug"]]),
            ])
    lineas.append(insert("libros_personas", [
        "isbn", "id_persona", "porcentaje", "monto_acordado", "id_rol", "id_libro",
    ], filas_relaciones, override=False))

    resenas = [(libro, url) for libro in CATALOGO["libros"] for url in libro["resenas"]]
    if resenas:
        lineas.append("-- Reseñas")
        lineas.append(insert("libro_resenas", ["id", "id_libro", "url", "user"], [
            [str(9_000_001 + i), str(LIBRO_ID[libro["slug"]]), q(url), str(USER_ID)]
            for i, (libro, url) in enumerate(resenas)
        ]))

    # ---- Movimientos: iniciales + extras + ventas ----
    eventos = []
    filas_movimientos = []
    filas_mov_lines = []

    def agregar_movimiento(
        mov_id: int,
        fecha: str,
        tipo: str,
        origen_tipo: str,
        origen_id: int | None,
        destino_tipo: str,
        destino_id: int | None,
        lineas_mov: list[dict],
        es_migracion: bool = False,
    ) -> None:
        filas_movimientos.append([
            str(mov_id), q(fecha), q(tipo), q(origen_tipo),
            str(origen_id) if origen_id is not None else "NULL",
            q(destino_tipo), str(destino_id) if destino_id is not None else "NULL",
            "NULL", q(es_migracion), str(USER_ID),
        ])
        for linea in lineas_mov:
            filas_mov_lines.append([
                str(mov_id), str(LIBRO_ID[linea["slug"]]), str(linea["cantidad"]),
                q(linea.get("precio")) if linea.get("precio") is not None else "NULL",
                str(USER_ID),
            ])
        eventos.append({
            "fecha": fecha,
            "origen": origen_id,
            "destino": destino_id,
            "lineas": lineas_mov,
        })

    # Ingresos iniciales por colección.
    for indice, coleccion in enumerate(CATALOGO["colecciones"]):
        libros_coleccion = [l for l in CATALOGO["libros"] if l["coleccion"] == coleccion["slug"]]
        agregar_movimiento(
            9_000_001 + indice,
            f"{FECHAS_INICIALES[coleccion['slug']]} 09:00:00",
            "ingreso", "exterior", None, "deposito", DEPOSITO_PRINCIPAL,
            [{"slug": l["slug"], "cantidad": l["stock_inicial"], "precio": None} for l in libros_coleccion],
        )

    # Movimientos extra (reprints, consignaciones, devoluciones, bajas).
    for movimiento in MOVIMIENTOS:
        origen = movimiento["origen"]
        destino = movimiento["destino"]
        agregar_movimiento(
            movimiento["id"],
            movimiento["fecha"],
            movimiento["tipo"],
            origen["tipo"],
            DEPOSITO_POR_CLAVE.get(origen.get("deposito")),
            destino["tipo"],
            DEPOSITO_POR_CLAVE.get(destino.get("deposito")),
            [{"slug": LIBRO_POR_ISBN[l["isbn"]]["slug"], "cantidad": l["cantidad"], "precio": l["precio"]}
             for l in movimiento["lineas"]],
        )

    # Movimientos de venta.
    for venta in VENTAS:
        agregar_movimiento(
            venta["id"],
            venta["fecha"],
            venta["tipo"],
            "deposito",
            DEPOSITO_POR_CLAVE[venta["deposito_origen"]],
            "exterior",
            None,
            [{"slug": LIBRO_POR_ISBN[l["isbn"]]["slug"], "cantidad": l["cantidad"], "precio": l["precio"]}
             for l in venta["lineas"]],
        )

    lineas.append("-- Movimientos (ingresos, consignaciones, devoluciones, bajas y ventas)")
    lineas.append(insert("movimientos", [
        "id", "fecha", "tipo", "origen_tipo", "origen_deposito_id",
        "destino_tipo", "destino_deposito_id", "file_path", "es_migracion", "user",
    ], filas_movimientos))
    lineas.append("-- Líneas de movimientos")
    lineas.append(insert("movimientos_libros", ["movimiento_id", "id_libro", "cantidad", "precio", "user"],
                         filas_mov_lines, override=False))

    lineas.append("-- Ventas")
    lineas.append(insert("ventas", [
        "id_movimiento", "descuento", "total", "id_medio_pago", "comision", "tipo_cbte", "id_cliente",
    ], [
        [str(v["id"]), str(v["descuento"]), str(v["total"]), str(MEDIO_IDS[v["medio_pago"]]),
         str(COMISIONES[v["medio_pago"]]), str(1 if v["comprobante_tipo"] == "factura_a" else 6),
         str(CLIENTE_ID[v["cliente"]])]
        for v in VENTAS
    ], override=False))

    # ---- Comprobantes ----
    comprobante_por_venta = {}
    filas_comprobantes = []
    filas_facturas = []
    numero_factura = {"factura_a": 0, "factura_b": 0}
    proximo_comprobante = 9_002_001

    for venta in sorted(VENTAS, key=lambda v: v["fecha"]):
        tipo = venta["comprobante_tipo"]
        if not tipo:
            continue
        cliente = CLIENTE_POR_SLUG[venta["cliente"]]
        numero_factura[tipo] += 1
        numero = numero_factura[tipo]
        comprobante_id = proximo_comprobante
        proximo_comprobante += 1
        comprobante_por_venta[venta["id"]] = comprobante_id
        subtotal = round(sum(l["cantidad"] * l["precio"] for l in venta["lineas"]), 2)
        envio = venta.get("costo_envio", 0)
        total = venta["total"]
        neto = round((total - envio) / 1.21, 2)
        iva = round(total - envio - neto, 2)
        items = [item_snapshot(l, venta["descuento"]) for l in venta["lineas"]]
        filas_comprobantes.append([
            str(comprobante_id), str(USER_ID), q(tipo), str(venta["id"]), "1", str(numero),
            q(venta["fecha"][:10]), q("emitida"), q("ARS"), str(subtotal), str(total),
            jsonb(emisor_snapshot()), jsonb(receptor_snapshot(cliente)), jsonb(items),
            "1", q(venta["fecha"]), q(venta["fecha"]),
        ])
        cae = f"75{comprobante_id:012d}"
        filas_facturas.append([
            str(comprobante_id), str(1 if tipo == "factura_a" else 6), q(cae),
            q(fecha_mas_dias(venta["fecha"], 10)[:10]), q("A"), jsonb([]), jsonb({}),
            q(f"https://www.afip.gob.ar/fe/qr/?p=demo-{comprobante_id}"),
            str(numero), str(envio), str(round(subtotal - (total - envio), 2)),
            str(neto), str(iva), "0", "0", "0", str(venta["descuento"]),
            "NULL", "NULL", "1", "NULL", q(venta["fecha"]), q(venta["fecha"]),
        ])

    # Remitos de consignaciones y devoluciones.
    proximo_remito_id = 9_002_801
    numero_remito = 0
    for movimiento in sorted(MOVIMIENTOS, key=lambda m: m["fecha"]):
        if movimiento.get("comprobante") != "remito":
            continue
        numero_remito += 1
        comprobante_id = proximo_remito_id
        proximo_remito_id += 1
        origen_id = DEPOSITO_POR_CLAVE.get(movimiento["origen"].get("deposito"))
        destino_id = DEPOSITO_POR_CLAVE.get(movimiento["destino"].get("deposito"))
        cliente_id = CLIENTE_POR_DEPOSITO.get(destino_id) or CLIENTE_POR_DEPOSITO.get(origen_id) or CLIENTE_CONSUMIDOR
        cliente = next(c for c in CLIENTE_POR_SLUG.values() if c["id"] == cliente_id)
        subtotal = round(sum(l["cantidad"] * (l["precio"] or 0) for l in movimiento["lineas"]), 2)
        items = [
            item_snapshot(
                {"isbn": l["isbn"], "cantidad": l["cantidad"], "precio": l["precio"] or 0},
                0,
            )
            for l in movimiento["lineas"]
        ]
        filas_comprobantes.append([
            str(comprobante_id), str(USER_ID), q("remito"), str(movimiento["id"]), "1", str(numero_remito),
            q(movimiento["fecha"][:10]), q("emitida"), q("ARS"), str(subtotal), str(subtotal),
            jsonb(emisor_snapshot()), jsonb(receptor_snapshot(cliente)), jsonb(items),
            "1", q(movimiento["fecha"]), q(movimiento["fecha"]),
        ])

    lineas.append("-- Comprobantes (facturas y remitos)")
    lineas.append(insert("comprobantes", [
        "id", "user", "tipo", "movimiento_id", "punto_venta", "numero", "fecha", "estado",
        "moneda", "importe_subtotal", "importe_total", "emisor", "receptor", "items",
        "plantilla_version", "creado_en", "actualizado_en",
    ], filas_comprobantes))
    if filas_facturas:
        lineas.append("-- Datos AFIP de las facturas")
        lineas.append(insert("facturas", [
            "comprobante_id", "codigo_afip", "cae", "cae_vencimiento", "resultado",
            "observaciones", "datos_afip", "qr_url", "numero_esperado", "importe_envio",
            "importe_descuento", "importe_neto", "importe_iva", "importe_exento",
            "importe_no_gravado", "importe_tributos", "descuento_porcentaje",
            "error_codigo", "error_mensaje", "intentos", "procesando_desde",
            "ultimo_intento_en", "emitido_en",
        ], filas_facturas, override=False))

    # ---- Stock final ----
    saldos: dict[tuple[int, int], int] = {}
    for evento in sorted(eventos, key=lambda e: e["fecha"]):
        for linea in evento["lineas"]:
            libro_id = LIBRO_ID[linea["slug"]]
            cantidad = linea["cantidad"]
            if evento["origen"] is not None:
                clave = (evento["origen"], libro_id)
                saldos[clave] = saldos.get(clave, 0) - cantidad
                if saldos[clave] < 0:
                    raise RuntimeError(f"Stock negativo en depósito {evento['origen']} libro {libro_id}")
            if evento["destino"] is not None:
                clave = (evento["destino"], libro_id)
                saldos[clave] = saldos.get(clave, 0) + cantidad

    lineas.append("-- Stock final por depósito")
    lineas.append(insert("deposito_libros", ["deposito_id", "id_libro", "cantidad", "user"], [
        [str(deposito_id), str(libro_id), str(cantidad), str(USER_ID)]
        for (deposito_id, libro_id), cantidad in sorted(saldos.items())
        if cantidad > 0
    ], override=False))

    # ---- Anticipos ----
    lineas.append("-- Anticipos")
    lineas.append(insert("anticipos", [
        "id", "id_libro", "id_persona", "id_rol", "monto", "fecha_lanzamiento",
        "pagado", "fecha_pago", "recuperado", "user",
    ], [
        [str(a["id"]), str(LIBRO_ID[a["libro"]]), str(PERSONA_ID[a["persona"]]),
         str(ROLE_IDS[a["rol"]]), str(a["monto"]), q(a["fecha_lanzamiento"]),
         q(a["pagado"]), q(a["fecha_pago"]), str(a["recuperado"]), str(USER_ID)]
        for a in ANTICIPOS
    ]))

    # ---- Liquidaciones ----
    filas_liq = []
    filas_liq_personas = []
    filas_liq_lineas = []
    filas_liq_ventas = []
    filas_liq_pagos = []
    proximo_persona = 9_004_101
    proximo_linea = 9_004_201
    proximo_pago = 9_004_301

    for indice, liquidacion in enumerate(LIQUIDACIONES_JSON["liquidaciones"]):
        liq_id = 9_004_001 + indice
        filas_liq.append([
            str(liq_id), q(liquidacion["codigo"]), q(liquidacion["desde"]),
            q(liquidacion["hasta"]), q(liquidacion["fecha_generacion"]), str(USER_ID),
        ])
        for persona in liquidacion["personas"]:
            persona_id = proximo_persona
            proximo_persona += 1
            filas_liq_personas.append([
                str(persona_id), str(liq_id), str(PERSONA_ID[persona["persona"]]),
                q(persona["nombre"]), str(persona["total"]), str(persona["anticipo"]), str(USER_ID),
            ])
            for detalle in persona["lineas"]:
                filas_liq_lineas.append([
                    str(proximo_linea), str(persona_id), str(LIBRO_ID[detalle["libro"]]),
                    q(detalle["titulo"]), str(ROLE_IDS[detalle["rol"]]), q(detalle["rol"]),
                    str(detalle["porcentaje"]), str(detalle["cantidad"]), str(detalle["importe"]),
                    str(detalle["anticipo"]), str(USER_ID),
                ])
                proximo_linea += 1
        for movimiento_id in liquidacion["ventas"]:
            filas_liq_ventas.append([str(movimiento_id), str(liq_id), str(USER_ID)])
        for pago in liquidacion["pagos"]:
            filas_liq_pagos.append([
                str(proximo_pago), str(liq_id), str(PERSONA_ID[pago["persona"]]),
                str(pago["monto"]), q(pago["fecha"]), q(pago["nota"]), "false", str(USER_ID),
            ])
            proximo_pago += 1

    lineas.append("-- Liquidaciones")
    lineas.append(insert("liquidaciones", ["id", "codigo", "desde", "hasta", "fecha_generacion", "user"], filas_liq))
    lineas.append("-- Personas de liquidaciones")
    lineas.append(insert("liquidacion_personas", ["id", "liquidacion_id", "id_persona", "nombre", "total", "anticipo", "user"], filas_liq_personas))
    lineas.append("-- Líneas de liquidaciones")
    lineas.append(insert("liquidacion_lineas", [
        "id", "liquidacion_persona_id", "id_libro", "titulo", "id_rol", "rol_nombre",
        "porcentaje", "cantidad", "importe", "anticipo", "user",
    ], filas_liq_lineas))
    lineas.append("-- Ventas cubiertas por liquidaciones")
    lineas.append(insert("liquidacion_ventas", ["movimiento_id", "liquidacion_id", "user"], filas_liq_ventas, override=False))
    lineas.append("-- Pagos de liquidaciones")
    lineas.append(insert("liquidacion_pagos", ["id", "liquidacion_id", "id_persona", "monto", "fecha", "nota", "anulado", "user"], filas_liq_pagos))

    # ---- Tienda ----
    integracion = TIENDA["integracion"]
    envio_config = TIENDA["envio_config"]
    lineas.append("-- Integración y configuración de tienda")
    lineas.append(insert("integraciones", [
        "id", "user", "nombre", "origen", "prefijo", "clave_hash", "activa",
        "revocada", "ultimo_uso", "creada_en", "actualizada_en",
    ], [[
        str(integracion["id"]), str(USER_ID), q(integracion["nombre"]), q(integracion["origen"]),
        q(integracion["prefijo"]), q(integracion["clave_hash"]), q(integracion["activa"]),
        q(integracion["revocada"]), q(integracion["ultimo_uso"]), q("2026-09-01 10:00:00"),
        q("2026-11-20 12:00:00"),
    ]]))
    lineas.append(insert("envio_config", [
        "id", "user", "peso_promedio_kg", "origen_calle", "origen_numero", "origen_localidad",
        "origen_provincia", "origen_codigo_postal", "caja_alto_cm", "caja_ancho_cm",
        "caja_largo_cm", "formato_etiqueta", "retiro_activo", "retiro_direccion",
        "retiro_horario", "creada_en", "actualizada_en",
    ], [[
        str(envio_config["id"]), str(USER_ID), str(envio_config["peso_promedio_kg"]),
        q(envio_config["origen_calle"]), q(envio_config["origen_numero"]),
        q(envio_config["origen_localidad"]), q(envio_config["origen_provincia"]),
        q(envio_config["origen_codigo_postal"]), str(envio_config["caja_alto_cm"]),
        str(envio_config["caja_ancho_cm"]), str(envio_config["caja_largo_cm"]),
        q("10x15"), q(envio_config["retiro_activo"]), q(envio_config["retiro_direccion"]),
        q(envio_config["retiro_horario"]), q("2026-09-01 10:00:00"), q("2026-11-20 12:00:00"),
    ]]))

    filas_pedidos = []
    filas_items = []
    filas_pagos = []
    filas_envios = []
    filas_envio_eventos = []
    filas_historial = []
    filas_reservas = []
    proximo_item = 9_006_101
    proximo_pago_tienda = 9_006_201
    proximo_envio = 9_006_301
    proximo_evento_envio = 9_006_401
    proximo_historial = 9_006_501
    proximo_reserva = 9_006_601

    for indice, pedido in enumerate(sorted(TIENDA["pedidos"], key=lambda p: p["fecha"])):
        pedido_id = 9_006_001 + indice
        comprobante_id = comprobante_por_venta.get(pedido["venta_id"])
        fecha = pedido["fecha"]
        filas_pedidos.append([
            str(pedido_id), str(USER_ID), str(integracion["id"]), q(pedido["codigo"]),
            q(f"demo-{pedido['codigo']}"), q(f"demo-{pedido['codigo']}"), "NULL",
            q(pedido["comprador"]["nombre"]), q(pedido["comprador"]["email"]),
            q(pedido["comprador"]["telefono"]), "NULL", q(pedido["entrega"]),
            q(pedido["calle"] or None), q("S/N" if pedido["entrega"] == "envio" else None),
            "NULL", "NULL", q(pedido["localidad"] or None), q(pedido["provincia"] or None),
            q(pedido["cp"] or None), q(envio_config["retiro_direccion"] if pedido["entrega"] == "retiro" else None),
            q(envio_config["retiro_horario"] if pedido["entrega"] == "retiro" else None),
            str(pedido["peso_kg"]), str(pedido["caja"]["alto"]), str(pedido["caja"]["ancho"]),
            str(pedido["caja"]["largo"]), q("https://tienda.demo.test/checkout/gracias"),
            q(pedido["estado"]), q(pedido["estado_pago"]), q("ARS"), str(pedido["subtotal"]),
            str(pedido["costo_envio"]), str(pedido["total"]),
            q("Pago rechazado" if pedido["estado"] == "rechazado" else None),
            q("El pago fue rechazado por el proveedor." if pedido["estado"] == "rechazado" else None),
            str(pedido["venta_id"]) if pedido["venta_id"] else "NULL",
            str(comprobante_id) if comprobante_id else "NULL",
            "NULL", "NULL", "NULL", "NULL",
            q("emitida" if comprobante_id else "pendiente"),
            q(fecha), q(fecha),
        ])

        for item in pedido["items"]:
            filas_items.append([
                str(proximo_item), str(USER_ID), str(pedido_id), str(item["id_libro"]),
                q(item["isbn"]), q(item["titulo"]), str(item["precio_unitario"]),
                str(item["cantidad"]), str(item["subtotal"]),
            ])
            proximo_item += 1

        estado_pago = pedido["estado_pago"]
        fecha_pago = fecha if estado_pago in ("aprobado", "rechazado", "reembolsado") else None
        filas_pagos.append([
            str(proximo_pago_tienda), str(USER_ID), str(pedido_id), q("mercadopago"),
            q(f"demo-mp-{pedido['numero']}"), q(f"demo-pref-{pedido['numero']}"),
            q(f"https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=demo-pref-{pedido['numero']}"),
            q(estado_pago), str(pedido["total"]), q("ARS"),
            q(fecha_mas_dias(fecha, 2)), q(fecha_pago), jsonb({}),
            jsonb({} if estado_pago != "reembolsado" else {"motivo": "Cancelación del pedido"}),
            q(fecha), q(fecha),
        ])
        proximo_pago_tienda += 1

        if pedido["entrega"] == "envio" and pedido["estado"] in ("enviado", "entregado"):
            envio_id = proximo_envio
            proximo_envio += 1
            entregado = pedido["estado"] == "entregado"
            filas_envios.append([
                str(envio_id), str(USER_ID), str(pedido_id), q("paqar"),
                q(f"demo-paqar-{pedido['numero']}"), q(f"PAQ-{pedido['numero']:08d}"),
                q("Entregado" if entregado else "En camino"),
                q(fecha_mas_dias(fecha, 3)), q(f"https://www.correoargentino.com.ar/seguimiento?codigo=PAQ-{pedido['numero']:08d}"),
                "NULL", "NULL", q(fecha_mas_dias(fecha, 1)), q(fecha_mas_dias(fecha, 1)),
                q(fecha), q(fecha_mas_dias(fecha, 3)),
            ])
            eventos = [
                ("En sucursal de origen", "En sucursal", fecha_mas_dias(fecha, 1)),
                ("En camino", "En camino", fecha_mas_dias(fecha, 2)),
            ]
            if entregado:
                eventos.append(("Entregado", "Entregado", fecha_mas_dias(fecha, 3)))
            for i, (descripcion, estado, fecha_evento) in enumerate(eventos):
                filas_envio_eventos.append([
                    str(proximo_evento_envio), str(USER_ID), str(envio_id),
                    q(f"demo-evt-{pedido['numero']}-{i}"), q(estado), q(estado.lower().replace(" ", "_")),
                    q("Sucursal Correo Argentino"), "NULL", q(descripcion), q(fecha_evento), q(fecha_evento),
                ])
                proximo_evento_envio += 1

        hitos = [("creado", "Pedido creado", fecha)]
        if estado_pago == "aprobado":
            hitos.append(("pago_aprobado", "Pago aprobado", fecha))
        elif estado_pago == "rechazado":
            hitos.append(("pago_rechazado", "Pago rechazado", fecha))
        elif estado_pago == "reembolsado":
            hitos.append(("pago_reembolsado", "Pago reembolsado", fecha))
        if pedido["estado"] in ("aceptado", "enviado", "entregado"):
            hitos.append(("aceptado", "Pedido aceptado y venta generada", fecha_mas_dias(fecha, 1)))
        if pedido["estado"] in ("enviado", "entregado"):
            hitos.append(("enviado", "Pedido despachado", fecha_mas_dias(fecha, 1)))
        if pedido["estado"] == "entregado":
            hitos.append(("entregado", "Pedido entregado", fecha_mas_dias(fecha, 3)))
        if pedido["estado"] == "rechazado":
            hitos.append(("rechazado", "Pedido rechazado", fecha))
        if pedido["estado"] == "cancelado":
            hitos.append(("cancelado", "Pedido cancelado", fecha))
        for tipo, descripcion, fecha_hito in hitos:
            filas_historial.append([
                str(proximo_historial), str(USER_ID), str(pedido_id), q(tipo),
                q(descripcion), q(fecha_hito),
            ])
            proximo_historial += 1

        for item in pedido["items"]:
            expira_reserva = (
                "2099-12-31 23:59:59"
                if pedido["reserva_estado"] == "activa"
                else fecha_mas_dias(fecha, 3)
            )
            filas_reservas.append([
                str(proximo_reserva), str(USER_ID), str(pedido_id), str(item["id_libro"]),
                str(DEPOSITO_PRINCIPAL), str(item["cantidad"]), q(pedido["reserva_estado"]),
                q(expira_reserva), q(fecha), q(fecha),
            ])
            proximo_reserva += 1

    lineas.append("-- Pedidos de tienda")
    lineas.append(insert("pedidos", [
        "id", "user", "integracion_id", "codigo", "referencia_externa", "clave_idempotencia",
        "hash_idempotencia", "comprador_nombre", "comprador_email", "comprador_telefono",
        "comprador_documento", "entrega_tipo", "entrega_calle", "entrega_numero",
        "entrega_piso", "entrega_depto", "entrega_localidad", "entrega_provincia",
        "entrega_codigo_postal", "retiro_direccion", "retiro_horario", "peso_kg",
        "caja_alto_cm", "caja_ancho_cm", "caja_largo_cm", "url_retorno", "estado",
        "estado_pago", "moneda", "subtotal", "costo_envio", "total", "motivo_rechazo",
        "detalle_rechazo", "venta_id", "comprobante_id", "comprobante_tipo",
        "comprobante_numero", "comprobante_fecha", "comprobante_file_path",
        "comprobante_estado", "creado_en", "actualizado_en",
    ], filas_pedidos))
    lineas.append("-- Items, pagos, envíos, historial y reservas de pedidos")
    lineas.append(insert("pedido_items", [
        "id", "user", "pedido_id", "id_libro", "isbn", "titulo",
        "precio_unitario", "cantidad", "subtotal",
    ], filas_items))
    lineas.append(insert("pagos", [
        "id", "user", "pedido_id", "proveedor", "pago_id", "preferencia_id", "init_point",
        "estado", "importe", "moneda", "vence_en", "fecha_pago", "datos",
        "datos_reembolso", "creado_en", "actualizado_en",
    ], filas_pagos))
    lineas.append(insert("envios", [
        "id", "user", "pedido_id", "proveedor", "proveedor_envio_id",
        "codigo_seguimiento", "estado", "ultima_actualizacion", "url_seguimiento",
        "etiqueta_file_path", "etiqueta_url", "etiqueta_creada_en", "despachado_en",
        "creado_en", "actualizado_en",
    ], filas_envios))
    lineas.append(insert("envio_eventos", [
        "id", "user", "envio_id", "evento_proveedor_id", "estado", "status_id",
        "facility", "sign", "descripcion", "fecha_evento", "creado_en",
    ], filas_envio_eventos))
    lineas.append(insert("pedido_historial", ["id", "user", "pedido_id", "tipo", "descripcion", "fecha"], filas_historial))
    lineas.append(insert("reservas", [
        "id", "user", "pedido_id", "id_libro", "deposito_id", "cantidad",
        "estado", "expira_en", "creada_en", "actualizada_en",
    ], filas_reservas))

    # ---- CMS de la landing ----
    lineas.append("-- Páginas del CMS")
    filas_paginas = []
    filas_bloques = []
    proximo_bloque = 9_007_101
    for pagina in CONTENIDO["paginas"]:
        filas_paginas.append([
            str(pagina["id"]), str(USER_ID), q(pagina["titulo"]), q(pagina["slug"]),
            q(pagina["descripcion"]), "NULL", "NULL", "NULL",
            q(pagina["visible_en_menu"]), str(pagina["orden"]), q(pagina["estado"]),
            q("2026-09-01 10:00:00"), q("2026-11-20 12:00:00"), str(USER_ID), "NULL",
        ])
        for posicion, bloque in enumerate(pagina["bloques"]):
            filas_bloques.append([
                str(proximo_bloque), str(USER_ID), str(pagina["id"]), q(bloque["tipo"]),
                str(posicion), jsonb(bloque),
            ])
            proximo_bloque += 1
    lineas.append(insert("contenido_paginas", [
        "id", "user", "titulo", "slug", "descripcion", "portada_imagen_id",
        "portada_texto_alternativo", "portada_epigrafe", "visible_en_menu", "orden",
        "estado", "creada_en", "actualizada_en", "actualizada_por", "deleted_at",
    ], filas_paginas))
    lineas.append(insert("contenido_bloques", ["id", "user", "pagina_id", "tipo", "posicion", "contenido"], filas_bloques))

    # ---- Secuencias ----
    lineas.append("-- Ajuste de secuencias")
    lineas.append("DO $$")
    lineas.append("BEGIN")
    for tabla, columna_id in [
        ("users", "id"), ("roles", "id"), ("clientes", "id"), ("depositos", "id"),
        ("medios_pago", "id"), ("colecciones", "id"), ("personas", "id"),
        ("libros", "id_libro"), ("precio_libros", "id"), ("libro_resenas", "id"),
        ("movimientos", "id"), ("comprobantes", "id"), ("anticipos", "id"),
        ("liquidaciones", "id"), ("liquidacion_personas", "id"),
        ("liquidacion_lineas", "id"), ("liquidacion_pagos", "id"),
        ("integraciones", "id"), ("envio_config", "id"), ("pedidos", "id"),
        ("pedido_items", "id"), ("pagos", "id"), ("envios", "id"),
        ("envio_eventos", "id"), ("pedido_historial", "id"), ("reservas", "id"),
        ("contenido_paginas", "id"), ("contenido_bloques", "id"),
    ]:
        lineas.append(
            f"    PERFORM setval(pg_get_serial_sequence('{tabla}', '{columna_id}')::regclass, "
            f"(SELECT MAX({columna_id}) FROM {tabla}));"
        )
    lineas.append("END $$;")
    lineas.append("")
    lineas.append("COMMIT;")
    lineas.append("")
    lineas.append(f"SELECT 'Demo cargada: {len(CATALOGO['libros'])} libros, {len(CLIENTES)} clientes, "
                  f"{len(VENTAS)} ventas, {len(TIENDA['pedidos'])} pedidos. "
                  f"Usuario: {CUENTA['username']} / demo12345' AS resultado;")
    lineas.append("")

    (SQL_DIR / "cargar_demo.sql").write_text("\n".join(lineas), encoding="utf-8")

    username = q(CUENTA["username"])
    limpiar = f"""-- Borra sólo los datos de la cuenta demo.
-- Correr antes de recargar cargar_demo.sql.

BEGIN;

DELETE FROM envio_eventos
WHERE "user" = (SELECT id FROM users WHERE username = {username});
DELETE FROM envios
WHERE "user" = (SELECT id FROM users WHERE username = {username});
DELETE FROM pagos
WHERE "user" = (SELECT id FROM users WHERE username = {username});
DELETE FROM reservas
WHERE "user" = (SELECT id FROM users WHERE username = {username});
DELETE FROM pedido_historial
WHERE "user" = (SELECT id FROM users WHERE username = {username});
DELETE FROM pedido_items
WHERE "user" = (SELECT id FROM users WHERE username = {username});
DELETE FROM pedidos
WHERE "user" = (SELECT id FROM users WHERE username = {username});

DELETE FROM facturas
WHERE comprobante_id IN (SELECT id FROM comprobantes WHERE "user" = (SELECT id FROM users WHERE username = {username}));
DELETE FROM comprobantes
WHERE "user" = (SELECT id FROM users WHERE username = {username});

DELETE FROM liquidacion_pagos
WHERE "user" = (SELECT id FROM users WHERE username = {username});
DELETE FROM liquidacion_lineas
WHERE "user" = (SELECT id FROM users WHERE username = {username});
DELETE FROM liquidacion_ventas
WHERE "user" = (SELECT id FROM users WHERE username = {username});
DELETE FROM liquidacion_personas
WHERE "user" = (SELECT id FROM users WHERE username = {username});
DELETE FROM liquidaciones
WHERE "user" = (SELECT id FROM users WHERE username = {username});
DELETE FROM anticipos
WHERE "user" = (SELECT id FROM users WHERE username = {username});

DELETE FROM ventas
WHERE id_movimiento IN (SELECT id FROM movimientos WHERE "user" = (SELECT id FROM users WHERE username = {username}));
DELETE FROM movimientos_libros
WHERE "user" = (SELECT id FROM users WHERE username = {username});
DELETE FROM movimientos
WHERE "user" = (SELECT id FROM users WHERE username = {username});
DELETE FROM deposito_libros
WHERE "user" = (SELECT id FROM users WHERE username = {username});

DELETE FROM libro_resenas
WHERE "user" = (SELECT id FROM users WHERE username = {username});
DELETE FROM libros_personas
WHERE id_libro IN (SELECT id_libro FROM libros WHERE "user" = (SELECT id FROM users WHERE username = {username}))
   OR id_persona IN (SELECT id FROM personas WHERE "user" = (SELECT id FROM users WHERE username = {username}));
DELETE FROM precio_libro_cliente
WHERE id_libro IN (SELECT id_libro FROM libros WHERE "user" = (SELECT id FROM users WHERE username = {username}))
   OR id_cliente IN (SELECT id FROM clientes WHERE "user" = (SELECT id FROM users WHERE username = {username}));
DELETE FROM libro_cliente
WHERE id_libro IN (SELECT id_libro FROM libros WHERE "user" = (SELECT id FROM users WHERE username = {username}))
   OR id_cliente IN (SELECT id FROM clientes WHERE "user" = (SELECT id FROM users WHERE username = {username}));
DELETE FROM precio_libros
WHERE "user" = (SELECT id FROM users WHERE username = {username});
DELETE FROM libros
WHERE "user" = (SELECT id FROM users WHERE username = {username});
DELETE FROM colecciones
WHERE "user" = (SELECT id FROM users WHERE username = {username});
DELETE FROM personas
WHERE "user" = (SELECT id FROM users WHERE username = {username});
DELETE FROM depositos
WHERE "user" = (SELECT id FROM users WHERE username = {username});
DELETE FROM clientes
WHERE "user" = (SELECT id FROM users WHERE username = {username});
DELETE FROM medios_pago
WHERE "user" = (SELECT id FROM users WHERE username = {username});
DELETE FROM roles
WHERE "user" = (SELECT id FROM users WHERE username = {username});
DELETE FROM tipos_edicion
WHERE "user" = (SELECT id FROM users WHERE username = {username});
DELETE FROM envio_config
WHERE "user" = (SELECT id FROM users WHERE username = {username});
DELETE FROM integraciones
WHERE "user" = (SELECT id FROM users WHERE username = {username});
DELETE FROM contenido_bloques
WHERE "user" = (SELECT id FROM users WHERE username = {username});
DELETE FROM contenido_paginas
WHERE "user" = (SELECT id FROM users WHERE username = {username});
DELETE FROM contenido_imagenes
WHERE "user" = (SELECT id FROM users WHERE username = {username});
DELETE FROM users
WHERE username = {username};

COMMIT;

SELECT 'Datos de la cuenta demo eliminados.' AS resultado;
"""
    (SQL_DIR / "limpiar_demo.sql").write_text(limpiar, encoding="utf-8")
    print(f"SQL: {SQL_DIR / 'cargar_demo.sql'}")
    print(f"SQL: {SQL_DIR / 'limpiar_demo.sql'}")
    print(f"Imágenes: {FILES_DIR}")


if __name__ == "__main__":
    main()
