import { db } from "../src/db/client";
import { clientesTable } from "../src/db/schema";
import { Client } from "../src/modules/cliente";
import { DepositoRepository } from "../src/modules/deposito";
import { SeedUser } from "./users.seeder";
import { nombreCompleto, domicilio, cuit, email } from "./data";

const CLIENTES_INSCRIPTOS_POR_USUARIO = 3;

// Insert directo (no `clienteService.create`): ese servicio llama a AFIP para
// resolver cond_fiscal/razon_social/domicilio del cuit, y un seeder de
// desarrollo no puede depender de una llamada de red real. El depósito propio
// de cada cliente sí se crea acá (mismo `depositoRepository.insert` que usaría
// el alta real, ver specs/009-ledger-unificado).
export async function seedClientes(
    users: SeedUser[],
    depositoRepository: Pick<DepositoRepository, "insert">
): Promise<Client[]> {
    const clientesNuevos: (typeof clientesTable.$inferInsert)[] = [];
    let indiceGlobal = 0;

    for (const user of users) {
        for (let i = 0; i < CLIENTES_INSCRIPTOS_POR_USUARIO; i++) {
            const nombre = nombreCompleto(indiceGlobal);
            clientesNuevos.push({
                nombre,
                email: email("cliente", indiceGlobal),
                cuit: cuit(100 + indiceGlobal),
                cond_fiscal: "RESPONSABLE INSCRIPTO",
                razon_social: nombre,
                domicilio: domicilio(indiceGlobal, "Mitre"),
                tipo: "inscripto",
                user: user.id
            });
            indiceGlobal++;
        }
    }

    const clientes = await db.insert(clientesTable).values(clientesNuevos).returning();

    for (const cliente of clientes) {
        await depositoRepository.insert({
            nombre: cliente.nombre,
            principal: false,
            user: cliente.user,
            id_cliente: cliente.id
        });
    }

    return clientes;
}
