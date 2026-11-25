#!/usr/bin/env python3
"""Genera movimientos, ventas, liquidaciones y pedidos de tienda.

Entradas: catalogo.json (generado), fuentes/cuenta.json y fuentes/clientes.json
(editados a mano). No genera clientes: los lee del JSON y les asigna IDs de
demo.

La simulación de stock es la parte importante: cada venta/consignación/devolución
se aplica sobre un depósito y nunca deja cantidades negativas. Los JSON que
escribe este script son la entrada de scripts/generar_sql.py.
"""

import json
import random
from datetime import date, datetime, timedelta
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
FUENTES = BASE / "fuentes"
PARAMETROS = json.loads((FUENTES / "parametros.json").read_text(encoding="utf-8"))
COMISIONES = PARAMETROS["comisiones"]
FECHAS_INICIALES = PARAMETROS["fechas_iniciales"]
MEDIOS = PARAMETROS["medios"]
PUNTO_VENTA = PARAMETROS["punto_venta"]

CATALOGO = json.loads((BASE / "catalogo.json").read_text(encoding="utf-8"))
CUENTA = json.loads((FUENTES / "cuenta.json").read_text(encoding="utf-8"))
CLIENTES_JSON = json.loads((FUENTES / "clientes.json").read_text(encoding="utf-8"))


def round2(valor: float) -> float:
    return round(valor + 1e-9, 2)

RNG = random.Random(PARAMETROS["semilla"])

USER_ID = 9_000_001
ROLE_IDS = {"Autor": 9_000_001, "Ilustrador": 9_000_002, "Prólogo": 9_000_003}
MEDIO_IDS = {nombre: 9_000_001 + i for i, nombre in enumerate(MEDIOS)}
PRINCIPAL = 9_000_001

LIBROS = CATALOGO["libros"]
LIBRO_POR_SLUG = {l["slug"]: l for l in LIBROS}
LIBRO_POR_ISBN = {l["isbn"]: l for l in LIBROS}
LIBRO_ID = {l["slug"]: 9_000_001 + i for i, l in enumerate(LIBROS)}
PERSONA_POR_SLUG = {p["slug"]: p for p in CATALOGO["personas"]}
FECHA_INICIAL = {slug: date.fromisoformat(fecha) for slug, fecha in FECHAS_INICIALES.items()}

CLIENTES = list(CLIENTES_JSON["clientes"])
CLIENTE_POR_SLUG = {c["slug"]: c for c in CLIENTES}
for i, cliente in enumerate(CLIENTES):
    cliente["id"] = 9_000_101 + i
    cliente["deposito_id"] = 9_000_101 + i
    cliente["deposito_key"] = f"cliente:{cliente['slug']}"

ESPECIALES = CLIENTES_JSON["especiales"]
CLIENTE_POR_SLUG.update({c["slug"]: c for c in ESPECIALES})
INSCRIPTOS = [c for c in CLIENTES if c["tipo"] == "inscripto"]

STOCK = {"principal": {l["slug"]: l["stock_inicial"] for l in LIBROS}}
for cliente in CLIENTES:
    STOCK[cliente["deposito_key"]] = {}

EXTRAS = []
VENTAS = []
PEDIDOS = []


def dt(valor: str) -> datetime:
    return datetime.fromisoformat(valor)


def disponible(deposito: str, slug: str, cuando: datetime) -> int:
    libro = LIBRO_POR_SLUG[slug]
    if cuando.date() < FECHA_INICIAL[libro["coleccion"]]:
        return 0
    return STOCK[deposito].get(slug, 0)


def aplicar(deposito: str, slug: str, delta: int) -> None:
    actual = STOCK[deposito].get(slug, 0)
    nuevo = actual + delta
    if nuevo < 0:
        raise RuntimeError(f"Stock negativo en {deposito}/{slug}: {actual} + {delta}")
    STOCK[deposito][slug] = nuevo


def aplicar_lineas(origen: str | None, destino: str | None, lineas: list[dict]) -> None:
    for linea in lineas:
        if origen:
            aplicar(origen, linea["slug"], -linea["cantidad"])
        if destino:
            aplicar(destino, linea["slug"], linea["cantidad"])


def elegir_lineas(
    deposito: str,
    cuando: datetime,
    cantidad: int,
    max_por_libro: int,
    reserva: int = 0,
) -> list[dict]:
    candidatos = [
        libro for libro in LIBROS
        if disponible(deposito, libro["slug"], cuando) >= (1 + reserva)
    ]
    RNG.shuffle(candidatos)
    elegidos = []
    for libro in candidatos[: cantidad * 2]:
        tope = min(max_por_libro, disponible(deposito, libro["slug"], cuando) - reserva)
        if tope < 1:
            continue
        cantidad_elegida = RNG.randint(1, tope)
        elegidos.append({
            "slug": libro["slug"],
            "isbn": libro["isbn"],
            "titulo": libro["titulo"],
            "cantidad": cantidad_elegida,
            "precio": libro["precio"],
        })
        if len(elegidos) == cantidad:
            break
    return elegidos


def extra(tipo: str, cuando: datetime, origen: dict, destino: dict, lineas: list[dict], comprobante: str | None) -> None:
    if not lineas:
        return
    aplicar_lineas(
        origen.get("deposito"),
        destino.get("deposito"),
        lineas,
    )
    EXTRAS.append({
        "fecha": cuando.isoformat(sep=" "),
        "tipo": tipo,
        "origen": origen,
        "destino": destino,
        "lineas": [
            {"isbn": l["isbn"], "cantidad": l["cantidad"], "precio": l["precio"]}
            for l in lineas
        ],
        "comprobante": comprobante,
    })


def factura_tipo(cliente: dict) -> str | None:
    if cliente["tipo"] == "negro":
        return None
    condicion = (cliente.get("cond_fiscal") or "").upper()
    return "factura_a" if "RESPONSABLE INSCRIPTO" in condicion and "NO INSCRIPTO" not in condicion else "factura_b"


def medio_ponderado(consignacion: bool) -> str:
    if consignacion:
        return RNG.choices(MEDIOS, weights=[25, 10, 5, 0, 60], k=1)[0]
    return RNG.choices(MEDIOS, weights=[20, 15, 15, 15, 35], k=1)[0]


def vender(cuando: datetime, cliente: dict, tipo: str, lineas: list[dict], descuento: int, medio: str) -> None:
    if not lineas:
        return
    origen = cliente["deposito_key"] if tipo == "ventaConsignacion" else "principal"
    aplicar_lineas(origen, None, [l for l in lineas])
    subtotal = sum(l["cantidad"] * l["precio"] for l in lineas)
    total = round2(subtotal * (1 - descuento / 100))
    VENTAS.append({
        "fecha": cuando.isoformat(sep=" "),
        "tipo": tipo,
        "cliente": cliente["slug"],
        "deposito_origen": origen,
        "medio_pago": medio,
        "descuento": descuento,
        "total": total,
        "costo_envio": 0,
        "comprobante_tipo": factura_tipo(cliente),
        "origen": "interno",
        "pedido": None,
        "lineas": [
            {"isbn": l["isbn"], "cantidad": l["cantidad"], "precio": l["precio"]}
            for l in lineas
        ],
    })


def fechas_venta() -> list[datetime]:
    dias = {
        6: [16, 18, 20, 23, 25, 27, 29],
        7: [3, 6, 9, 11, 14, 16, 18, 21, 23, 25, 28, 30],
        8: [3, 5, 7, 10, 12, 14, 17, 19, 21, 24, 26, 28],
        9: [2, 4, 7, 9, 11, 14, 16, 18, 21, 23, 25, 28],
        10: [2, 5, 7, 9, 12, 14, 16, 19, 21, 23, 26, 28],
        11: [2, 4, 6, 9, 11, 13, 16, 18, 20],
    }
    fechas = []
    for mes, lista in dias.items():
        for dia in lista:
            fechas.append(datetime(2026, mes, dia, RNG.randint(9, 18), RNG.choice([0, 15, 30])))
    return fechas


def construir_slots() -> list[dict]:
    slots = []

    # Reprints de títulos que se venden mucho.
    for fecha, slug, cantidad in [
        ("2026-07-06 09:00:00", "martin-fierro", 30),
        ("2026-07-06 09:10:00", "don-segundo-sombra", 25),
        ("2026-07-06 09:20:00", "la-bolsa", 16),
        ("2026-09-07 09:00:00", "cuentos-de-la-selva", 28),
        ("2026-09-07 09:10:00", "cuentos-de-amor-de-locura-y-de-muerte", 20),
        ("2026-09-07 09:20:00", "la-voragine", 16),
        ("2026-10-21 09:00:00", "ocre", 18),
        ("2026-10-21 09:10:00", "lunario-sentimental", 14),
        ("2026-10-21 09:20:00", "facundo", 18),
    ]:
        slots.append({"tipo": "reprint", "fecha": dt(fecha), "slug": slug, "cantidad": cantidad})

    # Consignaciones a librerías, al inicio de cada mes.
    for fecha in ["2026-06-18", "2026-07-02", "2026-08-03", "2026-09-02", "2026-10-02", "2026-11-03"]:
        elegidos = RNG.sample(INSCRIPTOS, k=RNG.choice([2, 3]))
        for cliente in elegidos:
            slots.append({"tipo": "consignacion", "fecha": dt(f"{fecha} 09:30:00"), "cliente": cliente})

    # Devoluciones y bajas.
    for fecha in ["2026-08-12", "2026-09-16", "2026-10-21", "2026-11-06"]:
        slots.append({"tipo": "devolucion", "fecha": dt(f"{fecha} 11:00:00")})
    for fecha in ["2026-08-14", "2026-10-09"]:
        slots.append({"tipo": "baja", "fecha": dt(f"{fecha} 12:00:00")})

    # Ventas internas.
    for cuando in fechas_venta():
        for _ in range(1 if RNG.random() < 0.75 else 2):
            cliente = RNG.choices(
                CLIENTES + [CLIENTE_POR_SLUG["consumidor-final"], CLIENTE_POR_SLUG["mostrador"]],
                weights=[7] * len(CLIENTES) + [12, 4],
                k=1,
            )[0]
            consignacion = cliente["tipo"] == "inscripto" and RNG.random() < 0.35
            slots.append({
                "tipo": "venta",
                "fecha": cuando,
                "cliente": cliente,
                "consignacion": consignacion,
            })

    # Pedidos de tienda.
    pedidos_def = [
        ("2026-09-12 10:15:00", "entregado", "envio", "Carla Méndez", "carla.mendez@demo.test", "Av. Rivadavia 2200", "Ciudad Autónoma de Buenos Aires", "1045"),
        ("2026-09-25 16:40:00", "enviado", "envio", "Julián Pérez", "julian.perez@demo.test", "San Juan 450", "Córdoba", "5000"),
        ("2026-10-08 11:05:00", "aceptado", "envio", "Marina Costa", "marina.costa@demo.test", "Ovidio Lagos 780", "Rosario", "2000"),
        ("2026-10-18 18:20:00", "pagado", "retiro", "Federico Ríos", "federico.rios@demo.test", "", "", ""),
        ("2026-11-24 09:50:00", "pendiente_pago", "envio", "Lucía Herrera", "lucia.herrera@demo.test", "Belgrano 120", "Mendoza", "5500"),
        ("2026-11-02 14:30:00", "rechazado", "envio", "Tomás Silva", "tomas.silva@demo.test", "Mitre 980", "Salta", "4400"),
        ("2026-11-12 17:10:00", "cancelado", "retiro", "Sofía Acosta", "sofia.acosta@demo.test", "", "", ""),
        ("2026-11-18 12:00:00", "entregado", "envio", "Bruno Ferreyra", "bruno.ferreyra@demo.test", "Alsina 300", "Bahía Blanca", "8000"),
    ]
    for i, (fecha, estado, entrega, nombre, email, calle, localidad, cp) in enumerate(pedidos_def, start=1):
        slots.append({
            "tipo": "pedido",
            "fecha": dt(fecha),
            "numero": i,
            "estado": estado,
            "entrega": entrega,
            "comprador": {"nombre": nombre, "email": email, "telefono": f"+54 9 11 5555-{1000 + i}"},
            "calle": calle,
            "localidad": localidad,
            "provincia": localidad if localidad != "Ciudad Autónoma de Buenos Aires" else "Ciudad Autónoma de Buenos Aires",
            "cp": cp,
        })

    return sorted(slots, key=lambda slot: (slot["fecha"], {"reprint": 0, "consignacion": 1, "devolucion": 1, "baja": 2, "venta": 3, "pedido": 4}[slot["tipo"]]))


def procesar_consignacion(slot: dict) -> None:
    lineas = elegir_lineas("principal", slot["fecha"], RNG.randint(3, 6), 5, reserva=6)
    if not lineas:
        return
    extra(
        "consignacion",
        slot["fecha"],
        {"tipo": "deposito", "deposito": "principal"},
        {"tipo": "deposito", "deposito": slot["cliente"]["deposito_key"]},
        lineas,
        "remito",
    )


def procesar_devolucion(slot: dict) -> None:
    candidatos = [c for c in CLIENTES if any(STOCK[c["deposito_key"]].values())]
    if not candidatos:
        return
    cliente = RNG.choice(candidatos)
    lineas = elegir_lineas(cliente["deposito_key"], slot["fecha"], RNG.randint(1, 2), 2)
    if not lineas:
        return
    extra(
        "devolucion",
        slot["fecha"],
        {"tipo": "deposito", "deposito": cliente["deposito_key"]},
        {"tipo": "deposito", "deposito": "principal"},
        lineas,
        "remito",
    )


def procesar_baja(slot: dict) -> None:
    lineas = elegir_lineas("principal", slot["fecha"], RNG.randint(1, 2), 1)
    if not lineas:
        return
    extra(
        "baja",
        slot["fecha"],
        {"tipo": "deposito", "deposito": "principal"},
        {"tipo": "exterior"},
        lineas,
        None,
    )


def procesar_venta(slot: dict) -> None:
    cliente = slot["cliente"]
    consignacion = slot["consignacion"] and cliente.get("deposito_key")
    deposito = cliente["deposito_key"] if consignacion else "principal"
    lineas = elegir_lineas(deposito, slot["fecha"], RNG.randint(1, 4), 4 if not consignacion else 3)
    if not lineas and consignacion:
        consignacion = False
        deposito = "principal"
        lineas = elegir_lineas(deposito, slot["fecha"], RNG.randint(1, 4), 4)
    if not lineas:
        return
    descuento = RNG.choices([0, 5, 10], weights=[70, 20, 10], k=1)[0]
    vender(
        slot["fecha"],
        cliente,
        "ventaConsignacion" if consignacion else "venta",
        lineas,
        descuento,
        medio_ponderado(consignacion),
    )


def procesar_pedido(slot: dict) -> None:
    lineas = elegir_lineas("principal", slot["fecha"], RNG.randint(1, 3), 2, reserva=2)
    if not lineas:
        return
    subtotal = sum(l["cantidad"] * l["precio"] for l in lineas)
    costo_envio = 0 if slot["entrega"] == "retiro" else 4500
    total = round2(subtotal + costo_envio)
    peso = round(sum(LIBRO_POR_SLUG[l["slug"]]["peso_kg"] * l["cantidad"] for l in lineas) + 0.15, 3)
    estado = slot["estado"]
    con_venta = estado in ("aceptado", "enviado", "entregado")
    pedido = {
        "numero": slot["numero"],
        "codigo": f"PED-2026-{slot['numero']:06d}",
        "fecha": slot["fecha"].isoformat(sep=" "),
        "estado": estado,
        "estado_pago": {
            "pendiente_pago": "pendiente",
            "pagado": "aprobado",
            "aceptado": "aprobado",
            "enviado": "aprobado",
            "entregado": "aprobado",
            "rechazado": "rechazado",
            "cancelado": "reembolsado",
        }[estado],
        "comprador": slot["comprador"],
        "entrega": slot["entrega"],
        "calle": slot["calle"],
        "localidad": slot["localidad"],
        "provincia": slot["provincia"],
        "cp": slot["cp"],
        "items": [
            {
                "id_libro": LIBRO_ID[l["slug"]],
                "isbn": l["isbn"],
                "titulo": l["titulo"],
                "precio_unitario": l["precio"],
                "cantidad": l["cantidad"],
                "subtotal": round2(l["precio"] * l["cantidad"]),
            }
            for l in lineas
        ],
        "subtotal": round2(subtotal),
        "costo_envio": costo_envio,
        "total": total,
        "peso_kg": peso,
        "caja": {"alto": 20, "ancho": 15, "largo": 10},
        "venta_id": None,
        "comprobante_tipo": "factura_b" if con_venta else None,
        "reserva_estado": "convertida" if con_venta else ("liberada" if estado in ("rechazado", "cancelado") else "activa"),
    }
    if con_venta:
        fecha_venta = slot["fecha"] + timedelta(days=1)
        VENTAS.append({
            "fecha": fecha_venta.isoformat(sep=" "),
            "tipo": "venta",
            "cliente": "consumidor-final",
            "deposito_origen": "principal",
            "medio_pago": "mercadopago",
            "descuento": 0,
            "total": total,
            "costo_envio": costo_envio,
            "comprobante_tipo": "factura_b",
            "origen": "tienda",
            "pedido": pedido["codigo"],
            "lineas": [
                {"isbn": l["isbn"], "cantidad": l["cantidad"], "precio": l["precio"]}
                for l in lineas
            ],
        })
        aplicar_lineas("principal", None, lineas)
    PEDIDOS.append(pedido)


def procesar_slots() -> None:
    for slot in construir_slots():
        if slot["tipo"] == "reprint":
            extra(
                "ingreso",
                slot["fecha"],
                {"tipo": "exterior"},
                {"tipo": "deposito", "deposito": "principal"},
                [{"slug": slot["slug"], "isbn": LIBRO_POR_SLUG[slot["slug"]]["isbn"],
                  "titulo": LIBRO_POR_SLUG[slot["slug"]]["titulo"],
                  "cantidad": slot["cantidad"], "precio": None}],
                None,
            )
        elif slot["tipo"] == "consignacion":
            procesar_consignacion(slot)
        elif slot["tipo"] == "devolucion":
            procesar_devolucion(slot)
        elif slot["tipo"] == "baja":
            procesar_baja(slot)
        elif slot["tipo"] == "venta":
            procesar_venta(slot)
        elif slot["tipo"] == "pedido":
            procesar_pedido(slot)


def asignar_ids() -> None:
    EXTRAS.sort(key=lambda e: e["fecha"])
    for i, movimiento in enumerate(EXTRAS):
        movimiento["id"] = 9_000_201 + i

    VENTAS.sort(key=lambda v: v["fecha"])
    venta_por_pedido = {}
    for i, venta in enumerate(VENTAS):
        venta["id"] = 9_001_001 + i
        if venta["pedido"]:
            venta_por_pedido[venta["pedido"]] = venta["id"]

    for pedido in PEDIDOS:
        pedido["venta_id"] = venta_por_pedido.get(pedido["codigo"])


def calcular_liquidaciones() -> dict:
    anticipos = [
        {"id": 9_003_001, "libro": "martin-fierro", "persona": "jose-hernandez", "rol": "Autor", "monto": 45000, "fecha_lanzamiento": "2026-06-15", "pagado": True, "fecha_pago": "2026-06-20", "recuperado": 0},
        {"id": 9_003_002, "libro": "don-segundo-sombra", "persona": "ricardo-guiraldes", "rol": "Autor", "monto": 30000, "fecha_lanzamiento": "2026-06-15", "pagado": True, "fecha_pago": "2026-06-20", "recuperado": 0},
        {"id": 9_003_003, "libro": "cuentos-de-la-selva", "persona": "horacio-quiroga", "rol": "Autor", "monto": 20000, "fecha_lanzamiento": "2026-10-15", "pagado": False, "fecha_pago": None, "recuperado": 0},
    ]
    clave_anticipo = {(a["libro"], a["persona"], a["rol"]): a for a in anticipos}

    periodos = [
        ("LQ-2026-0001", "2026-06-01", "2026-07-31", "2026-08-01 10:00:00", "mixto"),
        ("LQ-2026-0002", "2026-08-01", "2026-09-30", "2026-10-01 10:00:00", "parcial"),
        ("LQ-2026-0003", "2026-10-01", "2026-11-20", "2026-11-21 10:00:00", "ninguno"),
    ]
    liquidaciones = []

    for codigo, desde, hasta, generada, modo_pago in periodos:
        ventas_periodo = [
            venta for venta in VENTAS
            if desde <= venta["fecha"][:10] <= hasta and venta["tipo"] in ("venta", "ventaConsignacion")
        ]
        if not ventas_periodo:
            continue

        por_libro = {}
        for venta in ventas_periodo:
            for linea in venta["lineas"]:
                libro = LIBRO_POR_ISBN[linea["isbn"]]
                actual = por_libro.setdefault(libro["slug"], {"cantidad": 0, "importe": 0.0})
                actual["cantidad"] += linea["cantidad"]
                actual["importe"] = round2(actual["importe"] + linea["cantidad"] * linea["precio"])

        personas = {}
        for libro_slug, data in por_libro.items():
            libro = LIBRO_POR_SLUG[libro_slug]
            for relacion in libro["personas"]:
                clave = (libro_slug, relacion["persona"], relacion["rol"])
                persona = personas.setdefault(relacion["persona"], {
                    "persona": relacion["persona"],
                    "nombre": PERSONA_POR_SLUG[relacion["persona"]]["nombre"],
                    "lineas": [],
                })
                importe = round2(data["importe"] * relacion["porcentaje"] / 100)
                linea = {
                    "libro": libro_slug,
                    "titulo": libro["titulo"],
                    "rol": relacion["rol"],
                    "porcentaje": relacion["porcentaje"],
                    "cantidad": data["cantidad"],
                    "importe": importe,
                    "anticipo": 0,
                }
                anticipo = clave_anticipo.get(clave)
                if anticipo and anticipo["pagado"]:
                    saldo = round2(anticipo["monto"] - anticipo["recuperado"])
                    descuento = round2(min(importe, max(0, saldo)))
                    if descuento > 0:
                        linea["anticipo"] = descuento
                        anticipo["recuperado"] = round2(anticipo["recuperado"] + descuento)
                persona["lineas"].append(linea)

        personas_lista = []
        for persona in personas.values():
            bruto = round2(sum(linea["importe"] for linea in persona["lineas"]))
            anticipo = round2(sum(linea["anticipo"] for linea in persona["lineas"]))
            persona["total_bruto"] = bruto
            persona["anticipo"] = anticipo
            persona["total"] = round2(bruto - anticipo)
            personas_lista.append(persona)
        personas_lista.sort(key=lambda p: p["nombre"])

        pagos = []
        for indice, persona in enumerate(personas_lista):
            if persona["total"] <= 0:
                continue
            monto = 0
            if modo_pago == "mixto":
                if indice < 4:
                    monto = persona["total"]
                elif indice < 8:
                    monto = round2(persona["total"] * 0.5)
            elif modo_pago == "parcial" and indice < 6:
                monto = round2(persona["total"] * 0.5)
            if monto > 0:
                pagos.append({
                    "persona": persona["persona"],
                    "monto": monto,
                    "fecha": generada[:10],
                    "nota": None if monto >= persona["total"] else "Pago parcial",
                })

        liquidaciones.append({
            "codigo": codigo,
            "desde": desde,
            "hasta": hasta,
            "fecha_generacion": generada,
            "ventas": [venta["id"] for venta in ventas_periodo],
            "personas": personas_lista,
            "pagos": pagos,
        })

    return {"anticipos": anticipos, "liquidaciones": liquidaciones}


def validar() -> None:
    for deposito, libros in STOCK.items():
        for slug, cantidad in libros.items():
            if cantidad < 0:
                raise RuntimeError(f"Stock negativo final en {deposito}/{slug}: {cantidad}")
    for venta in VENTAS:
        suma = round2(sum(l["cantidad"] * l["precio"] for l in venta["lineas"]))
        esperado = round2(suma * (1 - venta["descuento"] / 100) + venta["costo_envio"])
        if abs(esperado - venta["total"]) > 0.01:
            raise RuntimeError(f"Total inconsistente en venta {venta.get('id')}: {esperado} != {venta['total']}")


def main() -> None:
    procesar_slots()
    asignar_ids()
    liquidaciones = calcular_liquidaciones()
    validar()

    (BASE / "movimientos.json").write_text(
        json.dumps({"movimientos": EXTRAS}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (BASE / "ventas.json").write_text(
        json.dumps({"ventas": VENTAS}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (BASE / "liquidaciones.json").write_text(
        json.dumps(liquidaciones, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (BASE / "tienda.json").write_text(
        json.dumps({
            "integracion": {
                "id": 9_005_001,
                "nombre": "Tienda demo",
                "origen": "https://tienda.demo.test",
                "prefijo": "demo",
                "clave_hash": "f" * 64,
                "activa": True,
                "revocada": False,
                "ultimo_uso": "2026-11-20 12:00:00",
            },
            "envio_config": {
                "id": 9_005_101,
                "peso_promedio_kg": 0.35,
                "origen_calle": "Av. Corrientes",
                "origen_numero": "1234",
                "origen_localidad": "Ciudad Autónoma de Buenos Aires",
                "origen_provincia": "Ciudad Autónoma de Buenos Aires",
                "origen_codigo_postal": "1043",
                "caja_alto_cm": 20,
                "caja_ancho_cm": 15,
                "caja_largo_cm": 10,
                "retiro_activo": True,
                "retiro_direccion": "Av. Corrientes 1234, CABA",
                "retiro_horario": "Lunes a viernes de 10 a 18",
            },
            "pedidos": PEDIDOS,
        }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    total_ventas = sum(v["total"] for v in VENTAS)
    print(f"Movimientos extra: {len(EXTRAS)}")
    print(f"Ventas: {len(VENTAS)} · facturado ${total_ventas:,.2f}")
    print(f"Pedidos: {len(PEDIDOS)}")
    print(f"Liquidaciones: {len(liquidaciones['liquidaciones'])} · anticipos: {len(liquidaciones['anticipos'])}")
    print(f"Stock final: {sum(sum(l.values()) for l in STOCK.values())} unidades")


if __name__ == "__main__":
    main()
