import { clienteStockService } from "../src/services/clienteStock.service";
import { Libro } from "../src/validators/libro.validator";
import { Client } from "../src/validators/cliente.validator";
import { SeedUser } from "./users.seeder";

const LIBROS_EN_CONSIGNACION_POR_CLIENTE = 4;

// Reusa `clienteStockService.moveStock`: es el mismo upsert que usaría una
// consignación real, y ya resuelve el conflicto (id_libro, id_cliente) sin
// que este seeder tenga que reimplementarlo.
export async function seedLibroCliente(users: SeedUser[], libros: Libro[], clientes: Client[]): Promise<void> {
    for (const user of users) {
        const librosDelUsuario = libros.filter((libro) => libro.user === user.id);
        const clientesInscriptos = clientes.filter((cliente) => cliente.user === user.id && cliente.tipo === "inscripto");

        for (const [i, cliente] of clientesInscriptos.entries()) {
            const librosParaConsignar = librosDelUsuario.slice(i, i + LIBROS_EN_CONSIGNACION_POR_CLIENTE);

            for (const libro of librosParaConsignar) {
                await clienteStockService.moveStock(
                    cliente.id,
                    { id_libro: libro.id_libro, isbn: libro.isbn, precio: libro.precio },
                    10
                );
            }
        }
    }
}
