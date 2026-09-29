import { DepositoPrincipal, DepositoConStock } from "../../lib/http/errors";
import { Deposito, DepositoInsert, DepositoUpdate } from "./deposito.validator";
import { DepositoRepository, DepositoResumen } from "./deposito.repository";

// Nombre del depósito que se crea solo al registrar un usuario (ver
// specs/008-movimientos-deposito). Es el que muestran las ayudas de los
// formularios de venta/consignación/devolución.
export const NOMBRE_DEPOSITO_PRINCIPAL = "Depósito principal";

// Shape público de un depósito: el resumen (`titulos`/`ejemplares`) se calcula
// en el repository, no se persiste.
export type PublicDeposito = Deposito & DepositoResumen;

export type DepositoServiceDeps = {
    repository: DepositoRepository;
};

export function createDepositoService({ repository }: DepositoServiceDeps) {
    const toPublic = (deposito: Deposito, resumen: DepositoResumen): PublicDeposito => ({ ...deposito, ...resumen });

    const create = async (data: DepositoInsert, userId: number): Promise<PublicDeposito> => {
        // `principal: false` explícito: el flag no es editable por API.
        const deposito = await repository.insert({ ...data, user: userId, principal: false });

        return toPublic(deposito, { titulos: 0, ejemplares: 0 });
    };

    const findAll = async (userId: number): Promise<PublicDeposito[]> => {
        const depositos = await repository.findAll({ user: userId });
        const resumenes = await repository.getResumenes(userId);

        return depositos.map((deposito) =>
            toPublic(deposito, resumenes.get(deposito.id) ?? { titulos: 0, ejemplares: 0 })
        );
    };

    const findOne = async (id: number, userId: number): Promise<PublicDeposito> => {
        const deposito = await repository.findOne({ id, user: userId });

        return toPublic(deposito, await repository.getResumen(id, userId));
    };

    const update = async (id: number, userId: number, data: DepositoUpdate): Promise<PublicDeposito> => {
        // Valida existencia/dueño antes de tocar nada (404 si no es del usuario).
        await repository.findOne({ id, user: userId });

        await repository.update({ id, user: userId }, data);

        return findOne(id, userId);
    };

    // Dos rechazos distintos de negocio: el principal (403) y el que todavía
    // tiene stock (409, con las cifras que lo bloquean). El 404 de inexistente
    // o de otro usuario sale de `findOne`.
    const remove = async (id: number, userId: number): Promise<void> => {
        const deposito = await repository.findOne({ id, user: userId });

        if (deposito.principal) {
            throw new DepositoPrincipal("El depósito principal no se puede eliminar");
        }

        const { ejemplares, titulos } = await repository.getResumen(id, userId);
        if (ejemplares > 0) {
            throw new DepositoConStock(
                `No se puede eliminar un depósito que todavía tiene stock: ${ejemplares} ejemplares en ${titulos} títulos`,
                ejemplares,
                titulos
            );
        }

        await repository.remove({ id, user: userId });
    };

    const getLibros = async (id: number, userId: number) => {
        const deposito = await repository.findOne({ id, user: userId });

        return {
            deposito: toPublic(deposito, await repository.getResumen(id, userId)),
            libros: await repository.getLibros(id, userId)
        };
    };

    return {
        create,
        findAll,
        findOne,
        update,
        remove,
        getLibros
    };
}

export type DepositoService = ReturnType<typeof createDepositoService>;
