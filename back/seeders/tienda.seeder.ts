import { createHash } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { orderHistoryTable, orderItemsTable, ordersTable } from "../src/db/schema";
import { CredentialsCipher } from "../src/lib/crypto/credentials";
import { Storage } from "../src/lib/storage";
import { Client, ClienteRepository } from "../src/modules/cliente";
import { DepositoRepository } from "../src/modules/deposito";
import { PublicLibro } from "../src/modules/libro";
import { MedioPagoService } from "../src/modules/medioPago";
import { SaleService } from "../src/modules/transaccion";
import { createIntegrationRepository } from "../src/modules/tienda/integration/integration.repository";
import { createIntegrationService } from "../src/modules/tienda/integration/integration.service";
import { createMercadoPagoRepository } from "../src/modules/tienda/payment/mercadopago.repository";
import { createPaymentRepository } from "../src/modules/tienda/payment/payment.repository";
import { createShipmentRepository } from "../src/modules/tienda/shipping/shipment.repository";
import { createShippingConfigRepository } from "../src/modules/tienda/shipping/shippingConfig.repository";
import { AvailabilityService } from "../src/modules/tienda/stock/availability.service";
import { SeedUser } from "./users.seeder";

const TIENDA_USERNAME = "libreria_sur";
const FACTURA_B = 6;
const PESO_PROMEDIO_KG = 0.5;
const CAJA = { alto: 10, ancho: 15, largo: 20 };
const COSTO_ENVIO = 3500;
const RETIRO = {
    direccion: "Librería Sur, San Martín 110, Rosario, Santa Fe",
    horario: "Lunes a viernes de 9 a 18 y sábados de 9 a 13"
};
const VENCIMIENTO_RESERVA_MS = 30 * 60 * 1000;
// El seed de demo no debe autodestruirse a los 30 minutos: el job de
// expiración cancelaría los pedidos pendientes antes de que se puedan probar.
const RESERVA_DEMO_MS = 30 * 24 * 60 * 60 * 1000;

type EstadoPedido = (typeof ordersTable.$inferSelect)["estado"];
type EstadoPago = (typeof ordersTable.$inferSelect)["estado_pago"];
type TipoEntrega = (typeof ordersTable.$inferSelect)["entrega_tipo"];

export type SeedTiendaDeps = {
    users: SeedUser[];
    libros: PublicLibro[];
    depositoRepository: Pick<DepositoRepository, "findPrincipal">;
    availabilityService: Pick<AvailabilityService, "reserve" | "release" | "convert">;
    saleService: Pick<SaleService, "record">;
    clienteRepository: Pick<ClienteRepository, "findConsumidorFinal">;
    medioPagoService: Pick<MedioPagoService, "findActivos">;
    storage: Storage;
    cipher: CredentialsCipher;
};

type Direccion = {
    calle: string;
    numero: string;
    piso: string | null;
    depto: string | null;
    localidad: string;
    provincia: string;
    codigoPostal: string;
};

type Comprador = {
    nombre: string;
    email: string;
    telefono: string | null;
    documento: string | null;
};

type PagoSpec = {
    estado: EstadoPago;
    fecha?: Date;
};

type EventoSpec = {
    id: string;
    estado: string;
    statusId: string;
    facility: string;
    descripcion: string;
    sign?: string | null;
    fecha: Date;
};

type EnvioSpec = {
    proveedorEnvioId: string;
    codigoSeguimiento: string;
    estado: string;
    etiqueta: boolean;
    etiquetaCreadaEn: Date;
    despachadoEn: Date | null;
    urlSeguimiento: string;
    eventos: EventoSpec[];
};

type PedidoSpec = {
    codigo: string;
    creadoEn: Date;
    estado: EstadoPedido;
    estadoPago: EstadoPago;
    entrega: TipoEntrega;
    comprador: Comprador;
    direccion?: Direccion;
    items: { libro: PublicLibro; cantidad: number }[];
    pagos: PagoSpec[];
    motivoRechazo?: string;
    detalleRechazo?: string;
    comprobanteEmitido?: boolean;
    envio?: EnvioSpec;
    expiraReserva?: Date;
};

type ContextoPedidos = {
    user: SeedUser;
    integracionId: number;
    cliente: Client;
    medioPagoId: number;
    principalId: number;
    availabilityService: SeedTiendaDeps["availabilityService"];
    saleService: SeedTiendaDeps["saleService"];
    storage: Storage;
};

const minutos = (fecha: Date, cantidad: number): Date =>
    new Date(fecha.getTime() + cantidad * 60_000);

const dias = (fecha: Date, cantidad: number): Date =>
    new Date(fecha.getTime() + cantidad * 24 * 60 * 60 * 1000);

const escaparTextoPdf = (texto: string): string =>
    texto.replace(/[\\()]/g, (caracter) => `\\${caracter}`).replace(/[^\x20-\x7e]/g, "?");

// PDF mínimo válido para que las descargas del panel funcionen sin depender de
// Chromium ni de un proveedor externo en el seed.
function crearPdf(titulo: string, lineas: string[]): Buffer {
    const contenido = [
        "BT",
        "/F1 16 Tf",
        "20 400 Td",
        `(${escaparTextoPdf(titulo)}) Tj`,
        "/F1 10 Tf",
        ...lineas.map((linea) => `0 -18 Td (${escaparTextoPdf(linea)}) Tj`),
        "ET"
    ].join("\n");

    const objetos = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 283 425] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        `<< /Length ${Buffer.byteLength(contenido, "latin1")} >>\nstream\n${contenido}\nendstream`
    ];

    const partes = ["%PDF-1.4\n"];
    const posiciones: number[] = [];
    let posicion = Buffer.byteLength(partes[0], "latin1");

    objetos.forEach((objeto, indice) => {
        posiciones.push(posicion);
        const parte = `${indice + 1} 0 obj\n${objeto}\nendobj\n`;
        partes.push(parte);
        posicion += Buffer.byteLength(parte, "latin1");
    });

    const inicioXref = posicion;
    partes.push(
        [
            "xref",
            `0 ${objetos.length + 1}`,
            "0000000000 65535 f ",
            ...posiciones.map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
            "trailer",
            `<< /Size ${objetos.length + 1} /Root 1 0 R >>`,
            "startxref",
            String(inicioXref),
            "%%EOF"
        ].join("\n")
    );

    return Buffer.from(partes.join(""), "latin1");
}

const pesoPedido = (items: PedidoSpec["items"]): number =>
    Math.round(items.reduce((total, item) => total + (item.libro.peso_kg ?? PESO_PROMEDIO_KG) * item.cantidad, 0) * 1000) / 1000;

const subtotalPedido = (items: PedidoSpec["items"]): number =>
    items.reduce((total, item) => total + item.libro.precio * item.cantidad, 0);

function direccionCompleta(direccion: Direccion): string {
    const partes = [`${direccion.calle} ${direccion.numero}`];
    if (direccion.piso) partes.push(`piso ${direccion.piso}`);
    if (direccion.depto) partes.push(`depto ${direccion.depto}`);
    partes.push(direccion.localidad, direccion.provincia, `CP ${direccion.codigoPostal}`);
    return partes.join(", ");
}

type Hito = { tipo: string; descripcion: string; fecha: Date };

function hitosDePago(spec: PedidoSpec): Hito[] {
    const base = spec.creadoEn;
    const hitos: Hito[] = [];

    const pagoAprobado = spec.pagos.find(
        (pago) => pago.estado === "aprobado" || pago.estado === "reembolsado"
    );
    if (pagoAprobado) {
        hitos.push({
            tipo: "pago_aprobado",
            descripcion: "Pago aprobado por MercadoPago",
            fecha: pagoAprobado.fecha ?? minutos(base, 10)
        });
    }

    const pagoRechazado = spec.pagos.find((pago) => pago.estado === "rechazado");
    if (pagoRechazado) {
        hitos.push({
            tipo: "pago_rechazado",
            descripcion: "Pago rechazado por MercadoPago",
            fecha: pagoRechazado.fecha ?? minutos(base, 10)
        });
    }

    return hitos;
}

function hitosDeDespacho(spec: PedidoSpec): Hito[] {
    if (!["aceptado", "enviado", "entregado"].includes(spec.estado)) return [];

    const base = spec.creadoEn;
    const hitos: Hito[] = [
        {
            tipo: "pedido_aceptado",
            descripcion: "Pedido aceptado y venta generada",
            fecha: minutos(base, 30)
        }
    ];

    if (spec.comprobanteEmitido) {
        hitos.push({
            tipo: "comprobante_emitido",
            descripcion: "Factura B emitida",
            fecha: minutos(base, 35)
        });
    }
    if (spec.envio?.etiqueta) {
        hitos.push({
            tipo: "etiqueta_generada",
            descripcion: "Etiqueta de PAQ.AR generada",
            fecha: spec.envio.etiquetaCreadaEn
        });
    }
    if (spec.envio?.despachadoEn) {
        hitos.push({
            tipo: "pedido_enviado",
            descripcion: `Pedido despachado con seguimiento ${spec.envio.codigoSeguimiento}`,
            fecha: spec.envio.despachadoEn
        });
    }
    if (spec.estado === "entregado") {
        hitos.push({
            tipo: "pedido_entregado",
            descripcion: spec.entrega === "retiro" ? "Pedido retirado en el local" : "Pedido entregado",
            fecha:
                spec.entrega === "retiro"
                    ? minutos(base, 120)
                    : spec.envio?.eventos.at(-1)?.fecha ?? dias(base, 2)
        });
    }

    return hitos;
}

function hitosDeCierre(spec: PedidoSpec): Hito[] {
    const base = spec.creadoEn;
    const hitos: Hito[] = [];

    if (spec.motivoRechazo) {
        hitos.push({
            tipo: "pedido_rechazado",
            descripcion: spec.detalleRechazo
                ? `${spec.motivoRechazo}: ${spec.detalleRechazo}`
                : spec.motivoRechazo,
            fecha: minutos(base, 20)
        });
    }
    if (spec.pagos.some((pago) => pago.estado === "reembolsado")) {
        hitos.push({
            tipo: "pago_reembolsado",
            descripcion: "Pago reembolsado por MercadoPago",
            fecha: minutos(base, 25)
        });
    }
    if (spec.estado === "cancelado") {
        hitos.push({
            tipo: "pedido_cancelado",
            descripcion: "Pedido cancelado por falta de pago; reserva liberada",
            fecha: minutos(base, 35)
        });
    }

    return hitos;
}

function hitosDelPedido(spec: PedidoSpec): Hito[] {
    return [
        { tipo: "pedido_creado", descripcion: "Pedido creado", fecha: spec.creadoEn },
        {
            tipo: "preferencia_creada",
            descripcion: "Preferencia de pago creada en MercadoPago",
            fecha: minutos(spec.creadoEn, 1)
        },
        ...hitosDePago(spec),
        ...hitosDeDespacho(spec),
        ...hitosDeCierre(spec)
    ].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
}

async function insertarPagos(
    contexto: ContextoPedidos,
    pedido: typeof ordersTable.$inferSelect,
    spec: PedidoSpec
): Promise<void> {
    const paymentRepository = createPaymentRepository({ db });
    const base = spec.creadoEn;

    for (const [indice, pago] of spec.pagos.entries()) {
        const preferenciaId = `seed-pref-${spec.codigo.toLowerCase()}-${indice + 1}`;
        const pagoId =
            pago.estado === "pendiente"
                ? null
                : `seed-pay-${spec.codigo.toLowerCase()}-${indice + 1}`;
        const fechaPago =
            pago.estado === "pendiente" ? null : pago.fecha ?? minutos(base, 10);

        await paymentRepository.insert({
            user: pedido.user,
            pedido_id: pedido.id,
            proveedor: "mercadopago",
            pago_id: pagoId,
            preferencia_id: preferenciaId,
            init_point: `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=${preferenciaId}`,
            estado: pago.estado,
            importe: pedido.total,
            moneda: "ARS",
            vence_en: minutos(base, 30),
            fecha_pago: fechaPago,
            datos: { origen: "seed", pedido: spec.codigo },
            datos_reembolso:
                pago.estado === "reembolsado"
                    ? { id: `seed-refund-${spec.codigo.toLowerCase()}`, fecha: fechaPago }
                    : null,
            creado_en: minutos(base, 2),
            actualizado_en: fechaPago ?? minutos(base, 2)
        });
    }
}

async function crearVentaDelPedido(
    contexto: ContextoPedidos,
    itemRows: { id_libro: number; isbn: string; titulo: string; precio_unitario: number; cantidad: number; subtotal: number }[],
    pedido: typeof ordersTable.$inferSelect
): Promise<void> {
    const filePath = `facturas/tienda-${pedido.codigo}-seed.pdf`;

    await db.transaction(async (tx) => {
        await contexto.availabilityService.reserve(
            pedido.id,
            itemRows.map((item) => ({
                id_libro: item.id_libro,
                isbn: item.isbn,
                titulo: item.titulo,
                cantidad: item.cantidad
            })),
            contexto.user.id,
            new Date(pedido.creado_en.getTime() + VENCIMIENTO_RESERVA_MS),
            tx
        );

        const { movimiento } = await contexto.saleService.record(
            {
                userId: contexto.user.id,
                tipo: "venta",
                idCliente: contexto.cliente.id,
                idMedioPago: contexto.medioPagoId,
                comision: 0,
                tipoCbte: FACTURA_B,
                descuento: 0,
                total: pedido.total,
                filePath,
                lines: itemRows.map((item) => ({
                    id_libro: item.id_libro,
                    isbn: item.isbn,
                    titulo: item.titulo,
                    cantidad: item.cantidad,
                    precio: item.precio_unitario
                })),
                origen: { tipo: "deposito", id: contexto.principalId },
                destino: { tipo: "exterior" }
            },
            tx
        );

        await contexto.availabilityService.convert(pedido.id, contexto.user.id, tx);

        await tx
            .update(ordersTable)
            .set({
                venta_id: movimiento.id,
                comprobante_file_path: pedido.comprobante_estado === "emitido" ? filePath : null,
                // Conserva el último hito del seed: la venta no debe mover la
                // fecha de actualización al momento en que corre el seeder.
                actualizado_en: pedido.actualizado_en
            })
            .where(and(eq(ordersTable.id, pedido.id), eq(ordersTable.user, contexto.user.id)));
    });
}

// La etiqueta se escribe antes de persistir el envío: si el storage falla, no
// queda una fila apuntando a un PDF que nunca existió.
async function crearEnvio(
    contexto: ContextoPedidos,
    pedido: typeof ordersTable.$inferSelect,
    spec: PedidoSpec
): Promise<void> {
    if (!spec.envio) return;

    const shipmentRepository = createShipmentRepository({ db });
    const etiquetaKey = `etiquetas/${spec.codigo}-seed.pdf`;

    if (spec.envio.etiqueta) {
        await contexto.storage.write(
            etiquetaKey,
            crearPdf("Etiqueta PAQ.AR", [
                `Pedido: ${spec.codigo}`,
                `Envio PAQ.AR: ${spec.envio.proveedorEnvioId}`,
                `Seguimiento: ${spec.envio.codigoSeguimiento}`,
                `Destinatario: ${spec.comprador.nombre}`,
                `Direccion: ${spec.direccion ? direccionCompleta(spec.direccion) : "Retiro en local"}`,
                `Peso: ${pesoPedido(spec.items).toFixed(3)} kg`,
                `Formato: 10x15`,
                "Libreria Sur SRL"
            ])
        );
    }

    const ultimaActualizacion = spec.envio.eventos.at(-1)?.fecha ?? spec.envio.despachadoEn ?? spec.envio.etiquetaCreadaEn;

    const envio = await shipmentRepository.insert({
        user: pedido.user,
        pedido_id: pedido.id,
        proveedor: "paqar",
        proveedor_envio_id: spec.envio.proveedorEnvioId,
        codigo_seguimiento: spec.envio.codigoSeguimiento,
        estado: spec.envio.estado,
        ultima_actualizacion: ultimaActualizacion,
        url_seguimiento: spec.envio.urlSeguimiento,
        etiqueta_file_path: spec.envio.etiqueta ? etiquetaKey : null,
        etiqueta_url: spec.envio.etiqueta
            ? `/pedidos/${spec.codigo}/etiqueta`
            : null,
        etiqueta_creada_en: spec.envio.etiqueta ? spec.envio.etiquetaCreadaEn : null,
        despachado_en: spec.envio.despachadoEn,
        creado_en: spec.envio.etiquetaCreadaEn,
        actualizado_en: ultimaActualizacion
    });

    for (const evento of spec.envio.eventos) {
        await shipmentRepository.insertEvent({
            user: pedido.user,
            envio_id: envio.id,
            evento_proveedor_id: evento.id,
            estado: evento.estado,
            status_id: evento.statusId,
            facility: evento.facility,
            sign: evento.sign ?? null,
            descripcion: evento.descripcion,
            fecha_evento: evento.fecha,
            creado_en: evento.fecha
        });
    }
}

function crearItemRows(contexto: ContextoPedidos, spec: PedidoSpec) {
    return spec.items.map((item) => ({
        user: contexto.user.id,
        id_libro: item.libro.id_libro,
        isbn: item.libro.isbn,
        titulo: item.libro.titulo,
        precio_unitario: item.libro.precio,
        cantidad: item.cantidad,
        subtotal: item.libro.precio * item.cantidad
    }));
}

async function escribirComprobante(
    contexto: ContextoPedidos,
    spec: PedidoSpec,
    subtotal: number,
    costoEnvio: number
): Promise<string | null> {
    if (!spec.comprobanteEmitido) return null;

    const key = `facturas/tienda-${spec.codigo}-seed.pdf`;
    await contexto.storage.write(
        key,
        crearPdf("Factura B", [
            "Libreria Sur SRL",
            `CUIT: ${contexto.user.cuit}`,
            "Factura B",
            `Pedido: ${spec.codigo}`,
            `Fecha: ${spec.creadoEn.toLocaleDateString("es-AR")}`,
            "Cliente: CONSUMIDOR FINAL",
            `Subtotal: $ ${subtotal.toFixed(2)}`,
            `Envio: $ ${costoEnvio.toFixed(2)}`,
            `Total: $ ${(subtotal + costoEnvio).toFixed(2)}`
        ])
    );
    return key;
}

// El snapshot del pedido entra completo en un solo insert; la complejidad
// viene de mapear columnas, no de ramas de negocio.
async function insertarPedido(
    contexto: ContextoPedidos,
    spec: PedidoSpec,
    subtotal: number,
    costoEnvio: number,
    comprobantePath: string | null,
    actualizadoEn: Date
): Promise<typeof ordersTable.$inferSelect> {
    const [pedido] = await db
        .insert(ordersTable)
        .values({
            user: contexto.user.id,
            integracion_id: contexto.integracionId,
            codigo: spec.codigo,
            referencia_externa: `seed-ref-${spec.codigo.toLowerCase()}`,
            clave_idempotencia: `seed-idem-${spec.codigo.toLowerCase()}`,
            hash_idempotencia: createHash("sha256").update(spec.codigo).digest("hex"),
            comprador_nombre: spec.comprador.nombre,
            comprador_email: spec.comprador.email,
            comprador_telefono: spec.comprador.telefono,
            comprador_documento: spec.comprador.documento,
            entrega_tipo: spec.entrega,
            entrega_calle: spec.direccion?.calle ?? null,
            entrega_numero: spec.direccion?.numero ?? null,
            entrega_piso: spec.direccion?.piso ?? null,
            entrega_depto: spec.direccion?.depto ?? null,
            entrega_localidad: spec.direccion?.localidad ?? null,
            entrega_provincia: spec.direccion?.provincia ?? null,
            entrega_codigo_postal: spec.direccion?.codigoPostal ?? null,
            retiro_direccion: spec.entrega === "retiro" ? RETIRO.direccion : null,
            retiro_horario: spec.entrega === "retiro" ? RETIRO.horario : null,
            peso_kg: spec.entrega === "envio" ? pesoPedido(spec.items) : null,
            caja_alto_cm: spec.entrega === "envio" ? CAJA.alto : null,
            caja_ancho_cm: spec.entrega === "envio" ? CAJA.ancho : null,
            caja_largo_cm: spec.entrega === "envio" ? CAJA.largo : null,
            url_retorno: "https://tienda.ejemplo.com/checkout/retorno",
            estado: spec.estado,
            estado_pago: spec.estadoPago,
            moneda: "ARS",
            subtotal,
            costo_envio: costoEnvio,
            total: subtotal + costoEnvio,
            motivo_rechazo: spec.motivoRechazo ?? null,
            detalle_rechazo: spec.detalleRechazo ?? null,
            comprobante_tipo: spec.comprobanteEmitido ? String(FACTURA_B) : null,
            comprobante_numero: spec.comprobanteEmitido
                ? String(1000 + Number(spec.codigo.slice(-6)))
                : null,
            comprobante_fecha: spec.comprobanteEmitido ? minutos(spec.creadoEn, 35) : null,
            comprobante_file_path: comprobantePath,
            comprobante_estado: spec.comprobanteEmitido ? "emitido" : "pendiente",
            creado_en: spec.creadoEn,
            actualizado_en: actualizadoEn
        })
        .returning();

    return pedido;
}

async function reservarSinVenta(
    contexto: ContextoPedidos,
    pedido: typeof ordersTable.$inferSelect,
    spec: PedidoSpec,
    itemRows: ReturnType<typeof crearItemRows>
): Promise<void> {
    const expiraEn =
        spec.estado === "pendiente_pago" || spec.estado === "pagado"
            ? spec.expiraReserva ?? new Date(Date.now() + RESERVA_DEMO_MS)
            : new Date(spec.creadoEn.getTime() + VENCIMIENTO_RESERVA_MS);

    await contexto.availabilityService.reserve(
        pedido.id,
        itemRows,
        contexto.user.id,
        expiraEn
    );

    if (spec.estado === "rechazado" || spec.estado === "cancelado") {
        await contexto.availabilityService.release(pedido.id, contexto.user.id);
    }
}

async function crearPedido(contexto: ContextoPedidos, spec: PedidoSpec): Promise<void> {
    const itemRows = crearItemRows(contexto, spec);
    const subtotal = subtotalPedido(spec.items);
    const costoEnvio = spec.entrega === "envio" ? COSTO_ENVIO : 0;
    const historial = hitosDelPedido(spec);
    const actualizadoEn = historial.at(-1)?.fecha ?? spec.creadoEn;
    const comprobantePath = await escribirComprobante(contexto, spec, subtotal, costoEnvio);

    const pedido = await insertarPedido(
        contexto,
        spec,
        subtotal,
        costoEnvio,
        comprobantePath,
        actualizadoEn
    );

    await db.insert(orderItemsTable).values(itemRows.map((item) => ({ ...item, pedido_id: pedido.id })));
    await insertarPagos(contexto, pedido, spec);

    const esAceptado = ["aceptado", "enviado", "entregado"].includes(spec.estado);
    if (esAceptado) {
        await crearVentaDelPedido(contexto, itemRows, pedido);
    } else {
        await reservarSinVenta(contexto, pedido, spec, itemRows);
    }

    await crearEnvio(contexto, pedido, spec);

    await db.insert(orderHistoryTable).values(
        historial.map((hito) => ({
            user: contexto.user.id,
            pedido_id: pedido.id,
            tipo: hito.tipo,
            descripcion: hito.descripcion,
            fecha: hito.fecha
        }))
    );
}

const comprador = (
    nombre: string,
    email: string,
    telefono: string | null,
    documento: string | null
): Comprador => ({ nombre, email, telefono, documento });

const direccion = (
    calle: string,
    numero: string,
    piso: string | null,
    depto: string | null,
    localidad: string,
    provincia: string,
    codigoPostal: string
): Direccion => ({ calle, numero, piso, depto, localidad, provincia, codigoPostal });

export async function seedTienda({
    users,
    libros,
    depositoRepository,
    availabilityService,
    saleService,
    clienteRepository,
    medioPagoService,
    storage,
    cipher
}: SeedTiendaDeps): Promise<void> {
    const user = users.find((candidato) => candidato.username === TIENDA_USERNAME);
    if (!user) {
        throw new Error(`No existe el usuario ${TIENDA_USERNAME}; el seed de tienda depende de él`);
    }

    const librosDelUsuario = libros.filter((libro) => libro.user === user.id);
    const [cliente, medios, principal] = await Promise.all([
        clienteRepository.findConsumidorFinal(user.id),
        medioPagoService.findActivos(user.id),
        depositoRepository.findPrincipal(user.id)
    ]);

    if (!cliente) throw new Error("Falta el cliente CONSUMIDOR FINAL de la cuenta del seed");
    const medioPago = medios.find((medio) => medio.nombre.toLowerCase() === "mercadopago");
    if (!medioPago) throw new Error("Falta el medio de pago MercadoPago de la cuenta del seed");

    const integrationService = createIntegrationService({
        repository: createIntegrationRepository({ db })
    });
    const integracionActiva = await integrationService.create(
        { nombre: "Tienda web", origen: "https://tienda.ejemplo.com" },
        user.id
    );
    await integrationService.registerUsage(integracionActiva.integracion.id, user.id);

    const integracionRevocada = await integrationService.create(
        { nombre: "Tienda en desarrollo", origen: "https://desarrollo.ejemplo.com" },
        user.id
    );
    await integrationService.revoke(integracionRevocada.integracion.id, user.id);

    const shippingConfigRepository = createShippingConfigRepository({ db });    await shippingConfigRepository.upsert({
        user: user.id,
        micorreo_usuario: "libreria_sur",
        micorreo_credencial_cifrada: cipher.encrypt("micorreo-seed-password"),
        micorreo_customer_id: "100012345",
        paqar_agreement: "AGREEMENT-SEED-001",
        paqar_api_key_cifrada: cipher.encrypt("paqar-seed-api-key"),
        paqar_seller_id: "SELLER-SEED-001",
        peso_promedio_kg: PESO_PROMEDIO_KG,
        origen_calle: "San Martín",
        origen_numero: "110",
        origen_piso: "2",
        origen_depto: "A",
        origen_localidad: "Rosario",
        origen_provincia: "S",
        origen_codigo_postal: "2000",
        caja_alto_cm: CAJA.alto,
        caja_ancho_cm: CAJA.ancho,
        caja_largo_cm: CAJA.largo,
        formato_etiqueta: "10x15",
        retiro_activo: true,
        retiro_direccion: RETIRO.direccion,
        retiro_horario: RETIRO.horario
    });

    const mercadoPagoRepository = createMercadoPagoRepository({ db });
    await mercadoPagoRepository.saveConnection({
        user: user.id,
        mpUserId: "123456789",
        alias: "libreria-sur",
        email: "pagos@libreriasur.test",
        aplicacionId: "mp-app-seed-001",
        accessTokenCifrado: cipher.encrypt("APP_USR-seed-access-token"),
        refreshTokenCifrado: cipher.encrypt("TG-seed-refresh-token"),
        vencimiento: dias(new Date(), 30)
    });

    const contexto: ContextoPedidos = {
        user,
        integracionId: integracionActiva.integracion.id,
        cliente,
        medioPagoId: medioPago.id,
        principalId: principal.id,
        availabilityService,
        saleService,
        storage
    };

    const libro = (indice: number): PublicLibro => {
        const elegido = librosDelUsuario[indice];
        if (!elegido) throw new Error(`El seed de tienda necesita el libro ${indice} de ${TIENDA_USERNAME}`);
        return elegido;
    };

    const haceDias = (cantidad: number, horasExtra = 0): Date =>
        dias(new Date(Date.now() - horasExtra * 60 * 60 * 1000), -cantidad);

    const specs: PedidoSpec[] = [
        {
            codigo: "PED-2026-000001",
            creadoEn: haceDias(9, 3),
            estado: "cancelado",
            estadoPago: "pendiente",
            entrega: "envio",
            comprador: comprador("Juan Pérez", "juan.perez@correo.test", "11 5555-1001", "30111222"),
            direccion: direccion("Av. Cabildo", "1250", "4", "B", "CABA", "C", "1426"),
            items: [
                { libro: libro(0), cantidad: 1 },
                { libro: libro(1), cantidad: 1 }
            ],
            pagos: [{ estado: "pendiente" }]
        },
        {
            codigo: "PED-2026-000002",
            creadoEn: haceDias(8, 1),
            estado: "rechazado",
            estadoPago: "pendiente",
            entrega: "retiro",
            comprador: comprador("María López", "maria.lopez@correo.test", null, null),
            items: [{ libro: libro(2), cantidad: 2 }],
            pagos: [{ estado: "pendiente" }],
            motivoRechazo: "Datos incompletos",
            detalleRechazo: "El comprador no completó teléfono ni documento para coordinar el retiro."
        },
        {
            codigo: "PED-2026-000003",
            creadoEn: haceDias(7, 2),
            estado: "rechazado",
            estadoPago: "reembolsado",
            entrega: "envio",
            comprador: comprador("Carlos Gómez", "carlos.gomez@correo.test", "11 5555-1003", "28999888"),
            direccion: direccion("Mitre", "845", null, null, "La Plata", "B", "1900"),
            items: [
                { libro: libro(3), cantidad: 1 },
                { libro: libro(4), cantidad: 2 }
            ],
            pagos: [{ estado: "reembolsado" }],
            motivoRechazo: "Sin stock",
            detalleRechazo: "No quedaban ejemplares de uno de los títulos al preparar el pedido."
        },
        {
            codigo: "PED-2026-000004",
            creadoEn: haceDias(6, 4),
            estado: "entregado",
            estadoPago: "aprobado",
            entrega: "retiro",
            comprador: comprador("Ana Fernández", "ana.fernandez@correo.test", "11 5555-1004", "32111444"),
            items: [
                { libro: libro(5), cantidad: 1 },
                { libro: libro(6), cantidad: 1 }
            ],
            pagos: [{ estado: "aprobado" }],
            comprobanteEmitido: true
        },
        {
            codigo: "PED-2026-000005",
            creadoEn: haceDias(5, 2),
            estado: "entregado",
            estadoPago: "aprobado",
            entrega: "envio",
            comprador: comprador("Diego Romero", "diego.romero@correo.test", "11 5555-1005", "30555666"),
            direccion: direccion("San Luis", "2210", "1", "A", "Córdoba", "X", "5000"),
            items: [
                { libro: libro(7), cantidad: 2 },
                { libro: libro(8), cantidad: 1 }
            ],
            pagos: [{ estado: "aprobado" }],
            comprobanteEmitido: true,
            envio: {
                proveedorEnvioId: "PAQ-SEED-0005",
                codigoSeguimiento: "CA123456785AR",
                estado: "entregado",
                etiqueta: true,
                etiquetaCreadaEn: minutos(haceDias(5, 2), 45),
                despachadoEn: dias(haceDias(5, 2), 1),
                urlSeguimiento: "https://www.correoargentino.com.ar/seguimiento/CA123456785AR",
                eventos: [
                    {
                        id: "EV-SEED-0005-1",
                        estado: "En tránsito",
                        statusId: "2",
                        facility: "Centro de clasificación Córdoba",
                        descripcion: "El envío salió del centro de clasificación",
                        fecha: dias(haceDias(5, 2), 1.2)
                    },
                    {
                        id: "EV-SEED-0005-2",
                        estado: "Entregado",
                        statusId: "4",
                        facility: "Sucursal Córdoba Centro",
                        descripcion: "Envío entregado al destinatario",
                        sign: "D. Romero",
                        fecha: dias(haceDias(5, 2), 2)
                    }
                ]
            }
        },
        {
            codigo: "PED-2026-000006",
            creadoEn: haceDias(4, 5),
            estado: "enviado",
            estadoPago: "aprobado",
            entrega: "envio",
            comprador: comprador("Lucía Martínez", "lucia.martinez@correo.test", "11 5555-1006", "33999111"),
            direccion: direccion("Belgrano", "640", "3", "C", "Mendoza", "M", "5500"),
            items: [
                { libro: libro(9), cantidad: 1 },
                { libro: libro(10), cantidad: 1 }
            ],
            pagos: [{ estado: "aprobado" }],
            comprobanteEmitido: true,
            envio: {
                proveedorEnvioId: "PAQ-SEED-0006",
                codigoSeguimiento: "CA123456786AR",
                estado: "en_transito",
                etiqueta: true,
                etiquetaCreadaEn: minutos(haceDias(4, 5), 45),
                despachadoEn: dias(haceDias(4, 5), 1),
                urlSeguimiento: "https://www.correoargentino.com.ar/seguimiento/CA123456786AR",
                eventos: [
                    {
                        id: "EV-SEED-0006-1",
                        estado: "En tránsito",
                        statusId: "2",
                        facility: "Centro de clasificación Mendoza",
                        descripcion: "El envío salió del centro de clasificación",
                        fecha: dias(haceDias(4, 5), 1.2)
                    },
                    {
                        id: "EV-SEED-0006-2",
                        estado: "En distribución",
                        statusId: "3",
                        facility: "Sucursal destino",
                        descripcion: "El envío está en camino al domicilio",
                        fecha: dias(haceDias(4, 5), 2)
                    }
                ]
            }
        },
        {
            codigo: "PED-2026-000007",
            creadoEn: haceDias(3, 6),
            estado: "enviado",
            estadoPago: "aprobado",
            entrega: "envio",
            comprador: comprador("Nicolás Suárez", "nicolas.suarez@correo.test", "11 5555-1007", "31777333"),
            direccion: direccion("Rivadavia", "980", null, "2", "Neuquén", "Q", "8300"),
            items: [
                { libro: libro(11), cantidad: 1 },
                { libro: libro(0), cantidad: 1 }
            ],
            pagos: [{ estado: "aprobado" }],
            comprobanteEmitido: true,
            envio: {
                proveedorEnvioId: "PAQ-SEED-0007",
                codigoSeguimiento: "CA123456787AR",
                estado: "en_transito",
                etiqueta: true,
                etiquetaCreadaEn: minutos(haceDias(3, 6), 45),
                despachadoEn: dias(haceDias(3, 6), 1),
                urlSeguimiento: "https://www.correoargentino.com.ar/seguimiento/CA123456787AR",
                eventos: [
                    {
                        id: "EV-SEED-0007-1",
                        estado: "En tránsito",
                        statusId: "2",
                        facility: "Centro de clasificación Neuquén",
                        descripcion: "El envío está en tránsito",
                        fecha: dias(haceDias(3, 6), 1.1)
                    }
                ]
            }
        },
        {
            codigo: "PED-2026-000008",
            creadoEn: haceDias(2, 2),
            estado: "aceptado",
            estadoPago: "aprobado",
            entrega: "envio",
            comprador: comprador("Sofía Acosta", "sofia.acosta@correo.test", "11 5555-1008", "34555444"),
            direccion: direccion("Corrientes", "3450", "8", "D", "CABA", "C", "1194"),
            items: [
                { libro: libro(1), cantidad: 2 },
                { libro: libro(2), cantidad: 1 }
            ],
            pagos: [{ estado: "aprobado" }],
            comprobanteEmitido: true,
            envio: {
                proveedorEnvioId: "PAQ-SEED-0008",
                codigoSeguimiento: "CA123456788AR",
                estado: "en_preparacion",
                etiqueta: true,
                etiquetaCreadaEn: minutos(haceDias(2, 2), 60),
                despachadoEn: null,
                urlSeguimiento: "https://www.correoargentino.com.ar/seguimiento/CA123456788AR",
                eventos: []
            }
        },
        {
            codigo: "PED-2026-000009",
            creadoEn: haceDias(1, 8),
            estado: "aceptado",
            estadoPago: "aprobado",
            entrega: "envio",
            comprador: comprador("Tomás Benítez", "tomas.benitez@correo.test", "11 5555-1009", "36888777"),
            direccion: direccion("Sarmiento", "1500", null, "1", "Salta", "A", "4400"),
            items: [{ libro: libro(3), cantidad: 1 }],
            pagos: [{ estado: "aprobado" }],
            comprobanteEmitido: false
        },
        {
            codigo: "PED-2026-000010",
            creadoEn: haceDias(1, 3),
            estado: "aceptado",
            estadoPago: "aprobado",
            entrega: "retiro",
            comprador: comprador("Valentina Flores", "valentina.flores@correo.test", "11 5555-1010", "39000111"),
            items: [
                { libro: libro(4), cantidad: 1 },
                { libro: libro(5), cantidad: 2 }
            ],
            pagos: [{ estado: "aprobado" }],
            comprobanteEmitido: true
        },
        {
            codigo: "PED-2026-000011",
            creadoEn: haceDias(0, 5),
            estado: "pagado",
            estadoPago: "aprobado",
            entrega: "envio",
            comprador: comprador("Martina Ríos", "martina.rios@correo.test", "11 5555-1011", "40222333"),
            direccion: direccion("Ovidio Lagos", "2100", "5", "A", "Rosario", "S", "2000"),
            items: [
                { libro: libro(6), cantidad: 1 },
                { libro: libro(7), cantidad: 1 }
            ],
            pagos: [{ estado: "aprobado" }],
            expiraReserva: dias(new Date(), 30)
        },
        {
            codigo: "PED-2026-000012",
            creadoEn: haceDias(0, 2),
            estado: "pendiente_pago",
            estadoPago: "pendiente",
            entrega: "retiro",
            comprador: comprador("Bruno Castro", "bruno.castro@correo.test", "11 5555-1012", "41555666"),
            items: [{ libro: libro(8), cantidad: 1 }],
            pagos: [{ estado: "rechazado" }],
            expiraReserva: dias(new Date(), 30)
        },
        {
            codigo: "PED-2026-000013",
            creadoEn: new Date(Date.now() - 20 * 60 * 1000),
            estado: "pendiente_pago",
            estadoPago: "pendiente",
            entrega: "envio",
            comprador: comprador("Camila Herrera", "camila.herrera@correo.test", "11 5555-1013", "42888999"),
            direccion: direccion("Alsina", "720", "2", "B", "Rosario", "S", "2000"),
            items: [
                { libro: libro(9), cantidad: 1 },
                { libro: libro(10), cantidad: 1 }
            ],
            pagos: [{ estado: "pendiente" }],
            expiraReserva: dias(new Date(), 30)
        }
    ];

    for (const spec of specs) {
        await crearPedido(contexto, spec);
    }

    console.log(
        `Tienda: ${specs.length} pedidos, 2 integraciones, configuración de envíos y MercadoPago para ${user.username}`
    );
}
