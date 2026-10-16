import { Duplicated } from "bradb";
import { Conflict } from "../../lib/http/errors";
import { RolRepository } from "./rol.repository";
import { Rol, RolInsert, RolRow, RolUpdate } from "./rol.validator";

export type RolServiceDeps = {
    repository: RolRepository;
};

export function createRolService({ repository }: RolServiceDeps) {
    const toPublic = (rol: RolRow): Rol => ({ id: rol.id, nombre: rol.nombre });

    // El nombre repetido sólo se rechaza entre roles activos, sin distinguir
    // mayúsculas: uno dado de baja no bloquea el alta (lo garantiza
    // `findByNombreActivo`).
    const create = async (data: RolInsert, userId: number): Promise<Rol> => {
        if (await repository.findByNombreActivo(data.nombre, userId)) {
            throw new Duplicated(`Ya tenés un rol con el nombre ${data.nombre}`);
        }

        return toPublic(await repository.insert({ ...data, user: userId }));
    };

    // `findOne` de bradb da 404 si el id no existe, es de otra cuenta o ya está
    // dado de baja: cubre los tres casos de rechazo del contrato.
    const update = async (id: number, userId: number, data: RolUpdate): Promise<Rol> => {
        await repository.findOne({ id, user: userId });

        if (await repository.findByNombreActivo(data.nombre, userId, id)) {
            throw new Duplicated(`Ya tenés un rol con el nombre ${data.nombre}`);
        }

        return toPublic(await repository.update({ id, user: userId }, data));
    };

    // Baja lógica: sólo se bloquea si un libro activo con una persona activa
    // usa el rol (ver plan, tarea 7).
    const remove = async (id: number, userId: number): Promise<void> => {
        await repository.findOne({ id, user: userId });

        if (await repository.enUso(id, userId)) {
            throw new Conflict("No podés dar de baja un rol que usan personas en sus libros");
        }

        await repository.remove({ id, user: userId });
    };

    return {
        findActivos: repository.findActivos,
        existsEnCuenta: repository.existsEnCuenta,
        create,
        update,
        remove
    };
}

export type RolService = ReturnType<typeof createRolService>;
