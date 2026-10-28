import { NotFound } from "bradb";
import type { Database, Tx } from "../../db/client";
import { aFechaISO } from "../../lib/fecha";
import { BadGateway, Conflict, ValidationError } from "../../lib/http/errors";
import type { AfipService, IAfip, VentaFiscal } from "../../lib/afip/Afip";
import { importesFiscales } from "../../lib/afip/Afip";
import type { Storage } from "../../lib/storage/storage";
import type { Client } from "../cliente";
import type { MedioPago } from "../medioPago";
import type { User, UserRepository } from "../user";
import {
    CODIGO_AFIP_POR_TIPO,
    TIPO_POR_CODIGO_AFIP,
    type ComprobanteEmisorSnapshot,
    type ComprobanteItemSnapshot,
    type ComprobanteReceptorSnapshot
} from "./comprobante.schema";
import {
    toComprobanteDTO,
    toComprobanteResumen,
    type ComprobanteDTO,
    type ComprobanteResumen
} from "./comprobante.serializer";
import type {
    ComprobanteConFactura,
    ComprobanteRepository,
    ComprobanteRow
} from "./comprobante.repository";

export type ComprobanteLinea = {
    isbn: string;
    titulo: string;
    cantidad: number;
    precio: number;
};

export type CrearFacturaInput = {
    userId: number;
    movimientoId: number;
    venta: VentaFiscal;
    cliente: Client;
    emisor: User;
    medioPago: Pick<MedioPago, "nombre"> | null;
    lineas: ComprobanteLinea[];
    importeEnvio?: number;
};

export type CrearRemitoInput = {
    userId: number;
    movimientoId: number;
    cliente: Client;
    emisor: User;
    lineas: ComprobanteLinea[];
    fecha: Date;
};

export type ComprobanteServiceDeps = {
    db: Database;
    repository: ComprobanteRepository;
    userRepository: Pick<UserRepository, "findOne">;
    afipService: Pick<
        AfipService,
        "getClient" | "facturar" | "proximoNumero" | "consultarComprobante"
    >;
    storage: Storage;
};

const PUNTO_VENTA_REMITO = 3;
const CLAIM_VIGENTE_MS = 5 * 60 * 1000;

const redondear = (value: number): number => Math.round(value * 100) / 100;

const puntoVentaDe = (emisor: User): number => {
    if (emisor.punto_venta === null || emisor.punto_venta === undefined) {
        throw new ValidationError(
            "Para poder facturar tenés que ingresar un punto de venta, podés hacerlo en tu perfil"
        );
    }

    return emisor.punto_venta;
};

const snapshotEmisor = (emisor: User, logoUrl: string | null): ComprobanteEmisorSnapshot => ({
    razonSocial: emisor.razon_social,
    cuit: emisor.cuit,
    condicionFiscal: emisor.cond_fiscal,
    domicilio: emisor.domicilio,
    // La cuenta sólo guarda el booleano de IIBB, no el número: se conserva el
    // CUIT que ya usaba la plantilla histórica para esa línea.
    ingresosBrutos: emisor.ingresos_brutos ? emisor.cuit : null,
    inicioActividades: emisor.fecha_inicio,
    email: emisor.email ?? null,
    logoUrl
});

const snapshotReceptor = (
    cliente: Client,
    medioPago: Pick<MedioPago, "nombre"> | null
): ComprobanteReceptorSnapshot => ({
    razonSocial: cliente.razon_social,
    cuit: cliente.cuit,
    documento: null,
    condicionFiscal: cliente.cond_fiscal,
    domicilio: cliente.domicilio,
    condicionVenta: medioPago?.nombre ?? "Contado"
});

// Los ítems son snapshots: título, ISBN y precio quedan congelados aunque
// después se edite el libro o se dé de baja el cliente.
const construirItems = (
    lineas: ComprobanteLinea[],
    descuentoPorcentaje: number,
    importeEnvio: number
): ComprobanteItemSnapshot[] => {
    const items: ComprobanteItemSnapshot[] = lineas.map((linea) => {
        const bruto = redondear(linea.precio * linea.cantidad);
        const importeDescuento = redondear((bruto * descuentoPorcentaje) / 100);

        return {
            isbn: linea.isbn,
            titulo: linea.titulo,
            autor: null,
            cantidad: linea.cantidad,
            precioUnitario: linea.precio,
            descuentoPorcentaje,
            importeDescuento,
            subtotal: redondear(bruto - importeDescuento)
        };
    });

    if (importeEnvio > 0) {
        items.push({
            isbn: null,
            titulo: "Envío",
            autor: null,
            cantidad: 1,
            precioUnitario: importeEnvio,
            descuentoPorcentaje: 0,
            importeDescuento: 0,
            subtotal: importeEnvio
        });
    }

    return items;
};

const subtotalDeLineas = (lineas: ComprobanteLinea[]): number =>
    redondear(lineas.reduce((total, linea) => total + linea.precio * linea.cantidad, 0));

const descuentoDeItems = (items: ComprobanteItemSnapshot[]): number =>
    redondear(items.reduce((total, item) => total + item.importeDescuento, 0));

const emisionEnCurso = (procesandoDesde: Date | null): boolean =>
    procesandoDesde !== null && Date.now() - procesandoDesde.getTime() < CLAIM_VIGENTE_MS;

const mensajeDeError = (error: unknown): string =>
    error instanceof Error ? error.message : "No se pudo emitir el comprobante";

const codigoDeError = (error: unknown): string | null => {
    if (typeof error === "object" && error !== null && "code" in error) {
        return String((error as { code: unknown }).code);
    }

    return null;
};

export function createComprobanteService({
    db,
    repository,
    userRepository,
    afipService,
    storage
}: ComprobanteServiceDeps) {
    const logoUrlDe = async (emisor: User): Promise<string | null> => {
        const key = `logos/${emisor.cuit}.png`;
        if (!(await storage.exists(key))) return null;

        return storage.getUrl(key);
    };

    const crearFactura = async (
        {
            userId,
            movimientoId,
            venta,
            cliente,
            emisor,
            medioPago,
            lineas,
            importeEnvio = 0
        }: CrearFacturaInput,
        tx: Tx
    ): Promise<ComprobanteRow> => {
        const tipo = TIPO_POR_CODIGO_AFIP[venta.tipo_cbte];
        if (!tipo) throw new ValidationError("El tipo de comprobante no es válido para AFIP");

        const items = construirItems(lineas, venta.descuento ?? 0, importeEnvio);
        const subtotal = subtotalDeLineas(lineas);
        const descuento = descuentoDeItems(items);
        const fiscales = importesFiscales(venta);

        const comprobante = await repository.insert(
            {
                user: userId,
                tipo,
                movimiento_id: movimientoId,
                punto_venta: puntoVentaDe(emisor),
                estado: "pendiente",
                moneda: "ARS",
                importe_subtotal: subtotal,
                importe_total: fiscales.total,
                emisor: snapshotEmisor(emisor, await logoUrlDe(emisor)),
                receptor: snapshotReceptor(cliente, medioPago),
                items
            },
            tx
        );

        await repository.insertFactura(
            {
                comprobante_id: comprobante.id,
                codigo_afip: CODIGO_AFIP_POR_TIPO[tipo],
                importe_envio: importeEnvio,
                importe_descuento: descuento,
                importe_neto: redondear(subtotal - descuento),
                importe_iva: fiscales.iva,
                importe_exento: fiscales.exento,
                importe_no_gravado: fiscales.noGravado,
                importe_tributos: fiscales.tributos,
                descuento_porcentaje: venta.descuento ?? 0
            },
            tx
        );

        return comprobante;
    };

    const crearRemito = async (
        { userId, movimientoId, cliente, emisor, lineas, fecha }: CrearRemitoInput,
        tx: Tx
    ): Promise<ComprobanteRow> => {
        const items = construirItems(lineas, 0, 0);
        const total = subtotalDeLineas(lineas);

        return repository.insert(
            {
                user: userId,
                tipo: "remito",
                movimiento_id: movimientoId,
                punto_venta: PUNTO_VENTA_REMITO,
                numero: movimientoId,
                fecha: aFechaISO(fecha),
                estado: "emitida",
                moneda: "ARS",
                importe_subtotal: total,
                importe_total: total,
                emisor: snapshotEmisor(emisor, await logoUrlDe(emisor)),
                receptor: snapshotReceptor(cliente, null),
                items
            },
            tx
        );
    };

    type ClaimResult =
        | { estado: "emitida"; comprobante: ComprobanteConFactura }
        | { estado: "error"; mensaje: string }
        | {
              estado: "listo";
              numeroEsperado: number;
              codigoAfip: number;
              descuentoPorcentaje: number;
              afip: IAfip;
          };

    const datosEmision = (fiscal: Awaited<ReturnType<AfipService["facturar"]>>) => ({
        numero: fiscal.numero,
        fecha: fiscal.fecha,
        cae: fiscal.cae,
        caeVencimiento: fiscal.caeVencimiento,
        resultado: fiscal.resultado,
        observaciones: fiscal.observaciones,
        importeTotal: fiscal.importe,
        qrUrl: fiscal.qrUrl,
        datosAfip: fiscal.datosAfip as unknown as Record<string, unknown>
    });

    // El claim se commitea antes de llamar a AFIP: si el proceso muere con el
    // comprobante ya autorizado, `numero_esperado` queda persistido y el
    // reintento lo adopta en vez de emitir otro.
    const reclamarEmision = async (
        id: number,
        userId: number,
        user: User,
        tx: Tx
    ): Promise<ClaimResult> => {
        const actual = await repository.findById(id, userId, tx, true);
        if (!actual) throw new NotFound(`No se encontró el comprobante con id ${id}`);
        if (actual.comprobante.tipo === "remito") {
            throw new Conflict("Un remito no se emite ante AFIP");
        }
        if (actual.comprobante.estado === "emitida") {
            return { estado: "emitida", comprobante: actual };
        }
        if (!actual.factura) throw new ValidationError("El comprobante no tiene datos fiscales");
        if (emisionEnCurso(actual.factura.procesando_desde)) {
            throw new Conflict("La factura se está emitiendo en este momento");
        }

        let afip: IAfip;
        let numeroEsperado = actual.factura.numero_esperado;

        // Sólo los errores de AFIP se traducen a estado `error`: un error de
        // DB tiene que hacer rollback de la transacción, no dejar escrituras
        // parciales.
        try {
            afip = afipService.getClient(user);

            if (actual.factura.intentos > 0 && numeroEsperado !== null) {
                const existente = await afipService.consultarComprobante({
                    numero: numeroEsperado,
                    puntoVenta: actual.comprobante.punto_venta,
                    codigoAfip: actual.factura.codigo_afip,
                    emisorCuit: actual.comprobante.emisor.cuit,
                    afip
                });
                if (existente) {
                    const comprobante = await repository.marcarEmitida(
                        actual.comprobante.id,
                        userId,
                        datosEmision(existente),
                        tx
                    );
                    return { estado: "emitida", comprobante };
                }
            }

            // Si el intento anterior no dejó comprobante en AFIP, se vuelve a
            // pedir el último autorizado: el número esperado viejo puede haber
            // quedado atrás por otra emisión.
            if (numeroEsperado === null || actual.factura.intentos > 0) {
                numeroEsperado = await afipService.proximoNumero(
                    afip,
                    actual.comprobante.punto_venta,
                    actual.factura.codigo_afip
                );
            }
        } catch (error) {
            if (error instanceof NotFound || error instanceof Conflict) throw error;

            const mensaje = mensajeDeError(error);
            console.error("[comprobante] Error preparando la emisión AFIP", {
                comprobanteId: actual.comprobante.id,
                userId,
                cuit: actual.comprobante.emisor.cuit,
                puntoVenta: actual.comprobante.punto_venta,
                error: mensaje
            });

            await repository.marcarError(
                actual.comprobante.id,
                userId,
                { codigo: codigoDeError(error), mensaje },
                tx
            );

            return { estado: "error", mensaje };
        }

        await repository.marcarProcesando(actual.comprobante.id, userId, numeroEsperado, tx);

        return {
            estado: "listo",
            numeroEsperado,
            codigoAfip: actual.factura.codigo_afip,
            descuentoPorcentaje: actual.factura.descuento_porcentaje,
            afip
        };
    };

    // El lock es de sesión (no de transacción) porque tiene que cubrir el
    // claim, la llamada a AFIP y la actualización final, que son transacciones
    // separadas por diseño.
    const conLockDeEmision = async <T>(lockKey: string, fn: () => Promise<T>): Promise<T> => {
        const client = await db.$client.connect();

        try {
            await client.query("select pg_advisory_lock(hashtext($1))", [lockKey]);
            return await fn();
        } finally {
            try {
                await client.query("select pg_advisory_unlock(hashtext($1))", [lockKey]);
            } finally {
                client.release();
            }
        }
    };

    const emitir = async (id: number, userId: number): Promise<ComprobanteConFactura> => {
        const user = await userRepository.findOne({ id: userId });
        const inicial = await repository.findById(id, userId);
        if (!inicial) throw new NotFound(`No se encontró el comprobante con id ${id}`);
        if (inicial.comprobante.tipo === "remito") {
            throw new Conflict("Un remito no se emite ante AFIP");
        }
        if (inicial.comprobante.estado === "emitida") return inicial;

        const lockKey = `comprobante:${userId}:${inicial.comprobante.punto_venta}:${inicial.comprobante.tipo}`;

        return conLockDeEmision(lockKey, async () => {
            const claim = await db.transaction((tx) => reclamarEmision(id, userId, user, tx));

            if (claim.estado === "emitida") return claim.comprobante;
            if (claim.estado === "error") throw new BadGateway(claim.mensaje);

            try {
                const fiscal = await afipService.facturar({
                    puntoVenta: inicial.comprobante.punto_venta,
                    venta: {
                        tipo_cbte: claim.codigoAfip,
                        total: inicial.comprobante.importe_total,
                        descuento: claim.descuentoPorcentaje
                    },
                    cliente: {
                        cuit: inicial.comprobante.receptor.cuit,
                        cond_fiscal: inicial.comprobante.receptor.condicionFiscal
                    },
                    emisorCuit: inicial.comprobante.emisor.cuit,
                    numeroEsperado: claim.numeroEsperado,
                    afip: claim.afip
                });

                return await db.transaction((tx) =>
                    repository.marcarEmitida(id, userId, datosEmision(fiscal), tx)
                );
            } catch (error) {
                const mensaje = mensajeDeError(error);
                console.error("[comprobante] Error emitiendo en AFIP", {
                    comprobanteId: id,
                    userId,
                    cuit: inicial.comprobante.emisor.cuit,
                    puntoVenta: inicial.comprobante.punto_venta,
                    error: mensaje
                });

                await db.transaction((tx) =>
                    repository.marcarError(
                        id,
                        userId,
                        { codigo: codigoDeError(error), mensaje },
                        tx
                    )
                );
                throw new BadGateway(mensaje);
            }
        });
    };

    // Emisión post-commit de los flujos de venta/pedido: si AFIP falla, la
    // venta ya está persistida y el comprobante queda `error` para reintentar.
    const emitirSiPendiente = async (id: number, userId: number): Promise<void> => {
        const comprobante = await repository.findById(id, userId);
        if (!comprobante || comprobante.comprobante.estado !== "pendiente") return;

        try {
            await emitir(id, userId);
        } catch {
            // El error ya quedó persistido en el comprobante por `emitir`.
        }
    };

    const getById = async (id: number, userId: number): Promise<ComprobanteDTO> => {
        const comprobante = await repository.findById(id, userId);
        if (!comprobante) throw new NotFound(`No se encontró el comprobante con id ${id}`);

        return toComprobanteDTO(comprobante);
    };

    const reintentar = async (id: number, userId: number): Promise<ComprobanteDTO> => {
        const comprobante = await repository.findById(id, userId);
        if (!comprobante) throw new NotFound(`No se encontró el comprobante con id ${id}`);
        if (comprobante.comprobante.tipo === "remito") {
            throw new Conflict("Un remito no se emite ante AFIP");
        }
        if (comprobante.comprobante.estado === "emitida") {
            return toComprobanteDTO(comprobante);
        }

        return toComprobanteDTO(await emitir(id, userId));
    };

    const resumenPorId = async (id: number, userId: number): Promise<ComprobanteResumen | null> => {
        const comprobante = await repository.findById(id, userId);
        return comprobante ? toComprobanteResumen(comprobante.comprobante) : null;
    };

    const resumenDeMovimiento = async (
        movimientoId: number,
        userId: number
    ): Promise<ComprobanteResumen | null> => {
        const comprobante = await repository.findByMovimientoId(movimientoId, userId);
        return comprobante ? toComprobanteResumen(comprobante) : null;
    };

    const resumenesDeMovimientos = async (
        movimientoIds: number[],
        userId: number
    ): Promise<Map<number, ComprobanteResumen>> => {
        const rows = await repository.findByMovimientoIds(movimientoIds, userId);

        return new Map(rows.map((row) => [row.movimiento_id, toComprobanteResumen(row)]));
    };

    return {
        crearFactura,
        crearRemito,
        emitir,
        emitirSiPendiente,
        getById,
        reintentar,
        resumenPorId,
        resumenDeMovimiento,
        resumenesDeMovimientos
    };
}

export type ComprobanteService = ReturnType<typeof createComprobanteService>;
