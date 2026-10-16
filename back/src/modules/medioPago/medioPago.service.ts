import { Duplicated } from "bradb";
import { MedioPagoRepository } from "./medioPago.repository";
import { MedioPago, MedioPagoInsert, MedioPagoRow, MedioPagoUpdate } from "./medioPago.validator";

export type MedioPagoServiceDeps = {
    repository: MedioPagoRepository;
};

export function createMedioPagoService({ repository }: MedioPagoServiceDeps) {
    const toPublic = (medio: MedioPagoRow): MedioPago => ({
        id: medio.id,
        nombre: medio.nombre,
        comision: medio.comision
    });

    // El nombre repetido sólo se rechaza entre medios activos: uno dado de
    // baja no bloquea el alta (lo garantiza `findByNombreActivo`).
    const create = async (data: MedioPagoInsert, userId: number): Promise<MedioPago> => {
        if (await repository.findByNombreActivo(data.nombre, userId)) {
            throw new Duplicated(`Ya tenés un medio de pago con el nombre ${data.nombre}`);
        }

        return toPublic(await repository.insert({ ...data, user: userId }));
    };

    // `findOne` de bradb da 404 si el id no existe, es de otra cuenta o ya está
    // dado de baja: cubre los tres casos de rechazo del contrato.
    const update = async (id: number, userId: number, data: MedioPagoUpdate): Promise<MedioPago> => {
        const actual = await repository.findOne({ id, user: userId });

        if (data.nombre !== undefined && (await repository.findByNombreActivo(data.nombre, userId, id))) {
            throw new Duplicated(`Ya tenés un medio de pago con el nombre ${data.nombre}`);
        }
        if (Object.keys(data).length === 0) return toPublic(actual);

        return toPublic(await repository.update({ id, user: userId }, data));
    };

    const remove = async (id: number, userId: number): Promise<void> => {
        await repository.remove({ id, user: userId });
    };

    const findActivo = async (id: number, userId: number): Promise<MedioPago> =>
        toPublic(await repository.findOne({ id, user: userId }));

    return {
        findActivos: repository.findActivos,
        existsEnCuenta: repository.existsEnCuenta,
        findActivo,
        create,
        update,
        remove
    };
}

export type MedioPagoService = ReturnType<typeof createMedioPagoService>;
