import { eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { librosPersonasTable } from "../src/db/schema";
import { PublicLibro } from "../src/modules/libro";
import { DepositoRepository } from "../src/modules/deposito";
import { MovimientoRepository } from "../src/modules/movimiento";
import { AnticipoService } from "../src/modules/anticipo";
import { SeedUser } from "./users.seeder";

// Libros (por índice dentro de la cuenta) que quedan con anticipo. Se eligen
// libros con un único rol (los índices múltiplos de 3 tienen autor +
// ilustrador en `librosPersonas.seeder`), así el seed deja exactamente un
// anticipo por libro.
const INDICES_CON_ANTICIPO = [1, 2, 4, 10];
// "Cartas desde el río" (índice 10): dos incorporaciones de stock posteriores
// al lanzamiento, para mostrar la reimpresión sin anticipo nuevo.
const INDICE_REIMPRESION = 10;
const REIMPRESIONES = 2;
const CANTIDAD_POR_INCORPORACION = 10;

// Registra una incorporación de stock (exterior → depósito principal). No
// mueve stock: el seed ya le dio stock al libro al crearlo; acá sólo se
// necesita el hecho para derivar el lanzamiento y las reimpresiones.
const registrarIncorporacion = async (
    userId: number,
    idLibro: number,
    principalId: number,
    movimientoRepository: MovimientoRepository
): Promise<void> => {
    await db.transaction(async (tx) => {
        const movimiento = await movimientoRepository.insert(
            {
                tipo: "ingreso",
                origen_tipo: "exterior",
                destino_tipo: "deposito",
                destino_deposito_id: principalId,
                user: userId
            },
            tx
        );

        await movimientoRepository.insertLibros(
            movimiento.id,
            userId,
            [{ id_libro: idLibro, cantidad: CANTIDAD_POR_INCORPORACION, precio: null }],
            tx
        );
    });
};

// Genera los anticipos del seed por el mismo camino que el alta real: define
// el monto acordado en la relación libro↔persona, registra el lanzamiento (y
// sus reimpresiones) y deja que el service de anticipos los cree (idempotente).
export async function seedAnticipos(
    users: SeedUser[],
    libros: PublicLibro[],
    depositoRepository: DepositoRepository,
    movimientoRepository: MovimientoRepository,
    anticipoService: Pick<AnticipoService, "generarDeLibro">
): Promise<void> {
    for (const user of users) {
        const librosDelUsuario = libros.filter((libro) => libro.user === user.id);
        const principal = await depositoRepository.findPrincipal(user.id);

        for (const indice of INDICES_CON_ANTICIPO) {
            const libro = librosDelUsuario[indice];
            const monto = 50000 + indice * 10000;

            await db
                .update(librosPersonasTable)
                .set({ monto_acordado: monto })
                .where(eq(librosPersonasTable.id_libro, libro.id_libro));

            const incorporaciones = 1 + (indice === INDICE_REIMPRESION ? REIMPRESIONES : 0);
            for (let i = 0; i < incorporaciones; i++) {
                await registrarIncorporacion(user.id, libro.id_libro, principal.id, movimientoRepository);
            }

            await anticipoService.generarDeLibro(libro.id_libro, user.id);
        }
    }
}
