import { libroPersonaService } from "../src/services/libroPersona.service";
import { LibroPersonaBody } from "../src/validators/libro_persona.validator";
import { Libro } from "../src/validators/libro.validator";
import { Persona } from "../src/validators/persona.validator";
import { SeedUser } from "./users.seeder";

// Reusa `libroPersonaService.addToLibro`: valida que libro y personas sean
// del mismo usuario, la misma regla que aplicaría el endpoint real.
export async function seedLibrosPersonas(users: SeedUser[], libros: Libro[], personas: Persona[]): Promise<void> {
    for (const user of users) {
        const librosDelUsuario = libros.filter((libro) => libro.user === user.id);
        const personasDelUsuario = personas.filter((persona) => persona.user === user.id);

        for (const [i, libro] of librosDelUsuario.entries()) {
            const autor = personasDelUsuario[i % personasDelUsuario.length];
            const ilustrador = personasDelUsuario[(i + 1) % personasDelUsuario.length];

            const items: LibroPersonaBody[] = [{ id_persona: autor.id, tipo: "autor", porcentaje: 10 }];
            // Un libro de cada tres también tiene ilustrador, para variar los datos.
            if (i % 3 === 0 && ilustrador.id !== autor.id) {
                items.push({ id_persona: ilustrador.id, tipo: "ilustrador", porcentaje: 5 });
            }

            await libroPersonaService.addToLibro(libro.isbn, user.id, items);
        }
    }
}
