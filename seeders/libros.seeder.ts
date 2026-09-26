import { Libro, LibroService } from "../src/modules/libro";
import { SeedUser } from "./users.seeder";
import { TITULOS_LIBRO, isbn } from "./data";

// Reusa `libroService.create`: además de insertar en `libros`, registra el
// precio inicial en `precio_libros` (historial), y duplicar ese insert acá
// violaría DRY. `libroService` entra por parámetro, mismo patrón que
// `personas.seeder.ts`.
export async function seedLibros(users: SeedUser[], libroService: LibroService): Promise<Libro[]> {
    const libros: Libro[] = [];
    let indiceGlobal = 0;

    for (const user of users) {
        for (const titulo of TITULOS_LIBRO) {
            libros.push(
                await libroService.create(
                    {
                        isbn: isbn(indiceGlobal),
                        titulo,
                        fecha_edicion: `20${10 + (indiceGlobal % 15)}-0${1 + (indiceGlobal % 9)}-15`,
                        precio: 5000 + (indiceGlobal % 20) * 750,
                        stock: 20 + (indiceGlobal % 10) * 5
                    },
                    user.id
                )
            );
            indiceGlobal++;
        }
    }

    return libros;
}
