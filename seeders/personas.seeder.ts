import { personaService } from "../src/services/persona.service";
import { Persona } from "../src/validators/persona.validator";
import { SeedUser } from "./users.seeder";
import { nombreCompleto, dni, email } from "./data";

const PERSONAS_POR_USUARIO = 6;

// Reusa `personaService.create` (no un insert directo): así el seed pasa
// por la misma validación de forma que el endpoint real, sin duplicarla acá.
export async function seedPersonas(users: SeedUser[]): Promise<Persona[]> {
    const personas: Persona[] = [];
    let indiceGlobal = 0;

    for (const user of users) {
        for (let i = 0; i < PERSONAS_POR_USUARIO; i++) {
            personas.push(
                await personaService.create({
                    dni: dni(indiceGlobal),
                    nombre: nombreCompleto(indiceGlobal),
                    email: email("persona", indiceGlobal),
                    user: user.id
                })
            );
            indiceGlobal++;
        }
    }

    return personas;
}
