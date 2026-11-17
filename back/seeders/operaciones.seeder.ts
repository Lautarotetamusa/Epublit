import { eq, and, inArray, isNull } from "drizzle-orm";
import { db } from "../src/db/client";
import { clientesTable, mediosPagoTable } from "../src/db/schema";
import { PublicLibro } from "../src/modules/libro";
import { DepositoRepository } from "../src/modules/deposito";
import { Client, ClienteStockService } from "../src/modules/cliente";
import { MovimientoRepository } from "../src/modules/movimiento";
import { VentaRepository } from "../src/modules/transaccion";
import { ComprobanteService } from "../src/modules/comprobante";
import { tipoCliente } from "../src/modules/cliente";
import { tipoComprobanteFiscal } from "../src/lib/afip/fiscal";
import { SeedUser } from "./users.seeder";

const VENTAS_POR_USUARIO = 4;
const CONSIGNACIONES_POR_USUARIO = 2;

const findClientesPorDefecto = async (userId: number): Promise<Client[]> => {
    return db
        .select()
        .from(clientesTable)
        .where(and(eq(clientesTable.user, userId), inArray(clientesTable.tipo, ["particular", "negro"])));
};

type SeedComprobanteService = Pick<ComprobanteService, "crearFactura" | "crearRemito" | "emitirSiPendiente">;

const lineaDeComprobante = (libro: PublicLibro, cantidad: number) => ({
    isbn: libro.isbn,
    titulo: libro.titulo,
    cantidad,
    precio: libro.precio
});

// Una "venta" real: un movimiento de tipo `venta` (principal → exterior) con
// sus líneas a precio de catálogo y su extensión de venta, moviendo el stock
// del depósito principal. Se factura igual que una venta real (salvo cliente
// "negro") para tener comprobantes emitidos que ver e imprimir; AFIP es el mock.
const crearVenta = async (
    user: SeedUser,
    cliente: Client,
    libro: PublicLibro,
    cantidad: number,
    principalId: number,
    idMedioPago: number,
    depositoRepository: DepositoRepository,
    movimientoRepository: MovimientoRepository,
    ventaRepository: VentaRepository,
    comprobanteService: SeedComprobanteService
): Promise<void> => {
    const comprobante = await db.transaction(async (tx) => {
        const movimiento = await movimientoRepository.insert(
            {
                tipo: "venta",
                origen_tipo: "deposito",
                origen_deposito_id: principalId,
                destino_tipo: "exterior",
                user: user.id
            },
            tx
        );
        await movimientoRepository.insertLibros(
            movimiento.id,
            user.id,
            [{ id_libro: libro.id_libro, cantidad, precio: libro.precio }],
            tx
        );
        const venta = await ventaRepository.insert(
            movimiento.id,
            {
                id_cliente: cliente.id,
                descuento: 0,
                id_medio_pago: idMedioPago,
                comision: 0,
                tipo_cbte: tipoComprobanteFiscal(user.cond_fiscal, cliente.cond_fiscal),
                total: libro.precio * cantidad
            },
            tx
        );
        await depositoRepository.moveStock(principalId, libro.id_libro, user.id, -cantidad, tx);

        if (cliente.tipo === tipoCliente.negro) return null;

        return comprobanteService.crearFactura(
            {
                userId: user.id,
                movimientoId: movimiento.id,
                venta,
                cliente,
                emisor: user,
                medioPago: { nombre: "efectivo" },
                lineas: [lineaDeComprobante(libro, cantidad)]
            },
            tx
        );
    });

    if (comprobante) {
        await comprobanteService.emitirSiPendiente(comprobante.id, user.id);
    }
};

// El medio "efectivo" que `createUser` le creó al usuario (comisión 0).
const findMedioEfectivo = async (userId: number): Promise<number> => {
    const [medio] = await db
        .select({ id: mediosPagoTable.id })
        .from(mediosPagoTable)
        .where(and(eq(mediosPagoTable.user, userId), eq(mediosPagoTable.nombre, "efectivo"), isNull(mediosPagoTable.deletedAt)));

    return medio.id;
};

// Una "consignación": movimiento de tipo `consignacion` (principal → depósito
// del cliente) con el precio congelado, sin extensión de venta.
const crearConsignacion = async (
    user: SeedUser,
    cliente: Client,
    libro: PublicLibro,
    cantidad: number,
    principalId: number,
    depositoRepository: DepositoRepository,
    clienteStockService: ClienteStockService,
    movimientoRepository: MovimientoRepository,
    comprobanteService: SeedComprobanteService
): Promise<void> => {
    const depositoCliente = await depositoRepository.findClienteDeposito(cliente.id, user.id);

    await db.transaction(async (tx) => {
        const movimiento = await movimientoRepository.insert(
            {
                tipo: "consignacion",
                origen_tipo: "deposito",
                origen_deposito_id: principalId,
                destino_tipo: "deposito",
                destino_deposito_id: depositoCliente.id,
                user: user.id
            },
            tx
        );
        await movimientoRepository.insertLibros(
            movimiento.id,
            user.id,
            [{ id_libro: libro.id_libro, cantidad, precio: libro.precio }],
            tx
        );
        await depositoRepository.moveStock(principalId, libro.id_libro, user.id, -cantidad, tx);
        await depositoRepository.moveStock(depositoCliente.id, libro.id_libro, user.id, cantidad, tx);
        await clienteStockService.setPrecio(cliente.id, { id_libro: libro.id_libro, isbn: libro.isbn, precio: libro.precio }, tx);
        await comprobanteService.crearRemito(
            {
                userId: user.id,
                movimientoId: movimiento.id,
                cliente,
                emisor: user,
                lineas: [lineaDeComprobante(libro, cantidad)],
                fecha: movimiento.fecha
            },
            tx
        );
    });
};

export async function seedOperaciones(
    users: SeedUser[],
    libros: PublicLibro[],
    clientesInscriptos: Client[],
    depositoRepository: DepositoRepository,
    clienteStockService: ClienteStockService,
    movimientoRepository: MovimientoRepository,
    ventaRepository: VentaRepository,
    comprobanteService: SeedComprobanteService
): Promise<void> {
    for (const user of users) {
        const librosDelUsuario = libros.filter((libro) => libro.user === user.id);
        const clientesPorDefecto = await findClientesPorDefecto(user.id);
        const clientesDelUsuario = clientesInscriptos.filter((cliente) => cliente.user === user.id);
        const principal = await depositoRepository.findPrincipal(user.id);
        const idMedioPago = await findMedioEfectivo(user.id);

        for (let i = 0; i < VENTAS_POR_USUARIO; i++) {
            const cliente = clientesPorDefecto[i % clientesPorDefecto.length];
            const libro = librosDelUsuario[i % librosDelUsuario.length];
            await crearVenta(user, cliente, libro, 1 + (i % 3), principal.id, idMedioPago, depositoRepository, movimientoRepository, ventaRepository, comprobanteService);
        }

        for (let i = 0; i < CONSIGNACIONES_POR_USUARIO; i++) {
            const cliente = clientesDelUsuario[i % clientesDelUsuario.length];
            const libro = librosDelUsuario[(i + VENTAS_POR_USUARIO) % librosDelUsuario.length];
            await crearConsignacion(user, cliente, libro, 2, principal.id, depositoRepository, clienteStockService, movimientoRepository, comprobanteService);
        }
    }
}
