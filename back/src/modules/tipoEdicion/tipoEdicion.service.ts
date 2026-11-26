import { Duplicated } from "bradb";
import { TipoEdicionRepository } from "./tipoEdicion.repository";
import { TipoEdicion, TipoEdicionInsert, TipoEdicionRow, TipoEdicionUpdate } from "./tipoEdicion.validator";

export type TipoEdicionServiceDeps = {
    repository: TipoEdicionRepository;
};

export function createTipoEdicionService({ repository }: TipoEdicionServiceDeps) {
    const toPublic = (tipo: TipoEdicionRow): TipoEdicion => ({ id: tipo.id, nombre: tipo.nombre });

    // El nombre repetido sólo se rechaza entre tipos activos, sin distinguir
    // mayúsculas: uno dado de baja no bloquea el alta (lo garantiza
    // `findByNombreActivo`).
    const create = async (data: TipoEdicionInsert, userId: number): Promise<TipoEdicion> => {
        if (await repository.findByNombreActivo(data.nombre, userId)) {
            throw new Duplicated(`Ya tenés un tipo de edición con el nombre ${data.nombre}`);
        }

        return toPublic(await repository.insert({ ...data, user: userId }));
    };

    // `findOne` de bradb da 404 si el id no existe, es de otra cuenta o ya está
    // dado de baja: cubre los tres casos de rechazo del contrato.
    const update = async (id: number, userId: number, data: TipoEdicionUpdate): Promise<TipoEdicion> => {
        await repository.findOne({ id, user: userId });

        if (await repository.findByNombreActivo(data.nombre, userId, id)) {
            throw new Duplicated(`Ya tenés un tipo de edición con el nombre ${data.nombre}`);
        }

        return toPublic(await repository.update({ id, user: userId }, data));
    };

    const remove = async (id: number, userId: number): Promise<void> => {
        await repository.remove({ id, user: userId });
    };

    return {
        findActivos: repository.findActivos,
        findDefault: repository.findDefault,
        existsEnCuenta: repository.existsEnCuenta,
        create,
        update,
        remove
    };
}

export type TipoEdicionService = ReturnType<typeof createTipoEdicionService>;
