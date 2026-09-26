import { eq, and, inArray } from "drizzle-orm";
import { db } from "../src/db/client";
import { clientesTable } from "../src/db/schema";
import { Libro, LibroService } from "../src/modules/libro";
import { Client, ClienteStockService } from "../src/modules/cliente";
import { TransaccionRepository, VentaRepository, LibroOperacion } from "../src/modules/transaccion";
import { SeedUser } from "./users.seeder";

const aLibroOperacion = (libro: Libro, cantidad: number): LibroOperacion => ({
    id_libro: libro.id_libro,
    isbn: libro.isbn,
    titulo: libro.titulo,
    cantidad,
    precio: libro.precio,
    stock: libro.stock ?? 0
});

const VENTAS_POR_USUARIO = 4;
const CONSIGNACIONES_POR_USUARIO = 2;

const findClientesPorDefecto = async (userId: number): Promise<Client[]> => {
    return db
        .select()
        .from(clientesTable)
        .where(and(eq(clientesTable.user, userId), inArray(clientesTable.tipo, ["particular", "negro"])));
};

// Una "venta" real: transacción + líneas de libros_transacciones + fila en
// ventas, todo en una transacción de Postgres y con el mismo descuento de
// stock que aplicaría `crearOperacion` (sin generar comprobante ni tocar
// AFIP, que no tienen sentido en datos de prueba).
const crearVenta = async (
    user: SeedUser,
    cliente: Client,
    libro: Libro,
    cantidad: number,
    libroService: LibroService,
    transaccionRepository: TransaccionRepository,
    ventaRepository: VentaRepository
): Promise<void> => {
    await db.transaction(async (tx) => {
        const transaccion = await transaccionRepository.insert(
            { type: "venta", id_cliente: cliente.id, file_path: "", user: user.id },
            tx
        );
        await transaccionRepository.saveLibros([aLibroOperacion(libro, cantidad)], transaccion.id, tx);
        await ventaRepository.insert(
            transaccion.id,
            { descuento: 0, medio_pago: "efectivo", tipo_cbte: 11, total: libro.precio * cantidad },
            tx
        );
        await libroService.moveStock(libro.id_libro, -cantidad, tx);
    });
};

// Una "consignación": mismo esquema de transacción/libros_transacciones que
// una venta pero sin fila en `ventas`, y el stock se mueve del usuario al
// cliente (no se descuenta del todo, como en una venta firme).
const crearConsignacion = async (
    user: SeedUser,
    cliente: Client,
    libro: Libro,
    cantidad: number,
    libroService: LibroService,
    clienteStockService: ClienteStockService,
    transaccionRepository: TransaccionRepository
): Promise<void> => {
    await db.transaction(async (tx) => {
        const transaccion = await transaccionRepository.insert(
            { type: "consignacion", id_cliente: cliente.id, file_path: "", user: user.id },
            tx
        );
        await transaccionRepository.saveLibros([aLibroOperacion(libro, cantidad)], transaccion.id, tx);
        await libroService.moveStock(libro.id_libro, -cantidad, tx);
        await clienteStockService.moveStock(cliente.id, { id_libro: libro.id_libro, isbn: libro.isbn, precio: libro.precio }, cantidad, tx);
    });
};

export async function seedOperaciones(
    users: SeedUser[],
    libros: Libro[],
    clientesInscriptos: Client[],
    libroService: LibroService,
    clienteStockService: ClienteStockService,
    transaccionRepository: TransaccionRepository,
    ventaRepository: VentaRepository
): Promise<void> {
    for (const user of users) {
        const librosDelUsuario = libros.filter((libro) => libro.user === user.id);
        const clientesPorDefecto = await findClientesPorDefecto(user.id);
        const clientesDelUsuario = clientesInscriptos.filter((cliente) => cliente.user === user.id);

        for (let i = 0; i < VENTAS_POR_USUARIO; i++) {
            const cliente = clientesPorDefecto[i % clientesPorDefecto.length];
            const libro = librosDelUsuario[i % librosDelUsuario.length];
            await crearVenta(user, cliente, libro, 1 + (i % 3), libroService, transaccionRepository, ventaRepository);
        }

        for (let i = 0; i < CONSIGNACIONES_POR_USUARIO; i++) {
            const cliente = clientesDelUsuario[i % clientesDelUsuario.length];
            const libro = librosDelUsuario[(i + VENTAS_POR_USUARIO) % librosDelUsuario.length];
            await crearConsignacion(user, cliente, libro, 2, libroService, clienteStockService, transaccionRepository);
        }
    }
}
