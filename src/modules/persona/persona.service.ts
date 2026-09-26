import { Duplicated } from "bradb";
import { PersonaRepository } from "./persona.repository";
import { PersonaInsert, PersonaUpdate } from "./persona.validator";

export type PersonaServiceDeps = {
    repository: PersonaRepository;
};

export function createPersonaService({ repository }: PersonaServiceDeps) {
    // Regla de negocio (no puede haber dos personas con el mismo dni para
    // el mismo usuario): antes vivía en el controller, ahora es
    // responsabilidad del service, que es quien conoce la regla.
    const create = async (data: PersonaInsert & { user: number }) => {
        if (await repository.exists(data.dni, data.user)) {
            throw new Duplicated(`La persona con dni ${data.dni} ya se encuentra cargada`);
        }

        return repository.insert(data);
    };

    // Misma regla que `create`, pero sólo se chequea si el dni realmente
    // cambia (actualizar sin tocar el dni no puede chocar consigo misma).
    const update = async (pk: { id: number; user: number }, data: PersonaUpdate) => {
        const persona = await repository.findOne(pk);

        if (data.dni && data.dni !== persona.dni && (await repository.exists(data.dni, pk.user))) {
            throw new Duplicated(`La persona con dni ${data.dni} ya se encuentra cargada`);
        }

        return repository.update(pk, data);
    };

    // Compone `findOne` + `getLibros`: antes el controller hacía las dos
    // llamadas y las combinaba a mano, que es lógica que le corresponde al
    // service, no al adapter HTTP.
    const findOneWithLibros = async (pk: { id: number; user: number }) => {
        const persona = await repository.findOne(pk);
        const libros = await repository.getLibros(pk.id, pk.user);

        return { ...persona, libros };
    };

    return {
        findOne: repository.findOne,
        findOneWithLibros,
        findAll: repository.findAll,
        create,
        update,
        remove: repository.remove,
        getAllByTipo: repository.getAllByTipo,
        getLibros: repository.getLibros
    };
}

export type PersonaService = ReturnType<typeof createPersonaService>;
