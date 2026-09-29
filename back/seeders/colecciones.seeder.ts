import { ColeccionService, PublicColeccion } from "../src/modules/coleccion";
import { SeedUser } from "./users.seeder";

// Colecciones de muestra del design.md (#10): sin libros y sin portada, sólo
// para que la pantalla de colecciones no arranque vacía en desarrollo.
const COLECCIONES_SEED: { titulo: string; descripcion: string }[] = [
    {
        titulo: "Clásicos recuperados",
        descripcion: "Títulos fundacionales del catálogo, reeditados con nueva traducción y prólogo."
    },
    {
        titulo: "Serie Aljibe",
        descripcion: "Narrativa argentina contemporánea en tapa blanda."
    },
    {
        titulo: "Álbum ilustrado",
        descripcion: "Primeros lectores y libros de imágenes, de 3 a 8 años."
    }
];

// Reusa `coleccionService.create` (mismo camino que el endpoint real, sin
// duplicar la validación de forma). Es idempotente por título: si la colección
// ya existe para el usuario no se vuelve a crear, así correr el seeder dos
// veces no duplica. Sólo el primer usuario: son los datos de muestra que se
// miran logueado como `libreria_sur`.
export async function seedColecciones(users: SeedUser[], coleccionService: ColeccionService): Promise<PublicColeccion[]> {
    const user = users[0];
    const existentes = await coleccionService.findAll(user.id);
    const yaCargadas = new Set(existentes.map((coleccion) => coleccion.titulo));

    const creadas: PublicColeccion[] = [];
    for (const coleccion of COLECCIONES_SEED) {
        if (yaCargadas.has(coleccion.titulo)) continue;

        creadas.push(await coleccionService.create(coleccion, user.id));
    }

    return creadas;
}
