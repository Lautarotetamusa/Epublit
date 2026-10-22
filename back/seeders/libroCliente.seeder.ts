import { PublicLibro } from "../src/modules/libro";
import { Client, ClienteStockService } from "../src/modules/cliente";
import { DepositoRepository } from "../src/modules/deposito";
import { SeedUser } from "./users.seeder";

const LIBROS_EN_CONSIGNACION_POR_CLIENTE = 4;
const CANTIDAD_CONSIGNADA = 10;

// Reusa el mismo camino que una consignación real: mueve la cantidad al
// depósito propio del cliente y congela el precio por libro (ver
// specs/009-ledger-unificado).
export async function seedLibroCliente(
    users: SeedUser[],
    libros: PublicLibro[],
    clientes: Client[],
    depositoRepository: Pick<DepositoRepository, "findClienteDeposito" | "moveStock">,
    clienteStockService: ClienteStockService
): Promise<void> {
    for (const user of users) {
        const librosDelUsuario = libros.filter((libro) => libro.user === user.id);
        const clientesInscriptos = clientes.filter((cliente) => cliente.user === user.id && cliente.tipo === "inscripto");

        for (const [i, cliente] of clientesInscriptos.entries()) {
            const deposito = await depositoRepository.findClienteDeposito(cliente.id, user.id);
            const librosParaConsignar = librosDelUsuario.slice(i, i + LIBROS_EN_CONSIGNACION_POR_CLIENTE);

            for (const libro of librosParaConsignar) {
                await depositoRepository.moveStock(deposito.id, libro.id_libro, user.id, CANTIDAD_CONSIGNADA);
                await clienteStockService.setPrecio(cliente.id, {
                    id_libro: libro.id_libro,
                    isbn: libro.isbn,
                    precio: libro.precio
                });
            }
        }
    }
}
