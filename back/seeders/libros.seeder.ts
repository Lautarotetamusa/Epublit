import { PublicLibro, LibroService } from "../src/modules/libro";
import { DepositoRepository } from "../src/modules/deposito";
import { SeedUser } from "./users.seeder";
import { TITULOS_LIBRO, isbn } from "./data";

// Reusa `libroService.create`: además de insertar en `libros`, registra el
// precio inicial en `precio_libros` (historial), y duplicar ese insert acá
// violaría DRY. El stock (que ya no es un dato del libro) se carga en el
// depósito principal del usuario con el mismo upsert que usa un movimiento.
// `libroService`/`depositoRepository` entran por parámetro, mismo patrón que
// el resto de los seeders.
export async function seedLibros(
    users: SeedUser[],
    libroService: LibroService,
    depositoRepository: DepositoRepository
): Promise<PublicLibro[]> {
    const libros: PublicLibro[] = [];
    let indiceGlobal = 0;

    for (const user of users) {
        const principal = await depositoRepository.findPrincipal(user.id);

        for (const titulo of TITULOS_LIBRO) {
            const libro = await libroService.create(
                {
                    isbn: isbn(indiceGlobal),
                    titulo,
                    fecha_edicion: `20${10 + (indiceGlobal % 15)}-0${1 + (indiceGlobal % 9)}-15`,
                    precio: 5000 + (indiceGlobal % 20) * 750
                },
                user.id
            );

            const cantidad = 20 + (indiceGlobal % 10) * 5;
            await depositoRepository.moveStock(principal.id, libro.id_libro, user.id, cantidad);

            libros.push(libro);
            indiceGlobal++;
        }
    }

    return libros;
}
