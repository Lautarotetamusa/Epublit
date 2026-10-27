import type { Tx } from "../../db/client";
import type { DepositoRepository } from "../deposito";
import type { MovimientoRepository } from "../movimiento";
import type { ExtremoOperacion } from "./operacion.types";
import type { VentaRepository } from "./venta.repository";

// Línea congelada de una venta: el precio es el del momento de la operación y
// no se vuelve a resolver contra el catálogo.
export type SaleLine = {
    id_libro: number;
    isbn: string;
    titulo: string;
    cantidad: number;
    precio: number;
};

export type SaleType = "venta" | "ventaConsignacion";

export type RecordSaleInput = {
    userId: number;
    tipo: SaleType;
    idCliente: number;
    idMedioPago: number;
    comision: number;
    tipoCbte: number;
    descuento: number;
    // Total explícito: para la tienda incluye el envío y no se recalcula con
    // las líneas de libro (ver specs/016-tienda-ecommerce).
    total: number;
    filePath: string;
    lines: SaleLine[];
    origen: ExtremoOperacion;
    destino: ExtremoOperacion;
};

export type SaleServiceDeps = {
    movimientoRepository: Pick<MovimientoRepository, "insert" | "insertLibros">;
    ventaRepository: Pick<VentaRepository, "insert">;
    depositoRepository: Pick<DepositoRepository, "moveStock">;
};

export type StockEffectInput = {
    userId: number;
    origen: ExtremoOperacion;
    destino: ExtremoOperacion;
    lines: SaleLine[];
    depositoRepository: Pick<DepositoRepository, "moveStock">;
};

// Único lugar que traduce los extremos de una operación comercial al stock de
// cada depósito: resta del origen y suma en el destino (el exterior no toca
// stock). Lo comparten las ventas y las operaciones no-venta.
export async function applyStockEffect(
    { userId, origen, destino, lines, depositoRepository }: StockEffectInput,
    tx: Tx
): Promise<void> {
    if (origen.tipo === "deposito") {
        for (const line of lines) {
            await depositoRepository.moveStock(origen.id, line.id_libro, userId, -line.cantidad, tx);
        }
    }
    if (destino.tipo === "deposito") {
        for (const line of lines) {
            await depositoRepository.moveStock(destino.id, line.id_libro, userId, line.cantidad, tx);
        }
    }
}

// Registro de una venta real: movimiento + líneas con precios congelados +
// extensión de venta + efecto de stock. La aceptación de pedidos y la venta
// interna usan exactamente esta pieza (ver specs/016-tienda-ecommerce).
export function createSaleService({
    movimientoRepository,
    ventaRepository,
    depositoRepository
}: SaleServiceDeps) {
    const record = async (input: RecordSaleInput, tx: Tx) => {
        const movimiento = await movimientoRepository.insert(
            {
                tipo: input.tipo,
                origen_tipo: input.origen.tipo,
                origen_deposito_id: input.origen.tipo === "deposito" ? input.origen.id : null,
                destino_tipo: input.destino.tipo,
                destino_deposito_id: input.destino.tipo === "deposito" ? input.destino.id : null,
                file_path: input.filePath,
                user: input.userId
            },
            tx
        );

        await movimientoRepository.insertLibros(
            movimiento.id,
            input.userId,
            input.lines.map((line) => ({
                id_libro: line.id_libro,
                cantidad: line.cantidad,
                precio: line.precio
            })),
            tx
        );

        const venta = await ventaRepository.insert(
            movimiento.id,
            {
                id_cliente: input.idCliente,
                descuento: input.descuento,
                id_medio_pago: input.idMedioPago,
                comision: input.comision,
                tipo_cbte: input.tipoCbte,
                total: input.total
            },
            tx
        );

        await applyStockEffect(
            {
                userId: input.userId,
                origen: input.origen,
                destino: input.destino,
                lines: input.lines,
                depositoRepository
            },
            tx
        );

        return { movimiento, venta };
    };

    return { record };
}

export type SaleService = ReturnType<typeof createSaleService>;
