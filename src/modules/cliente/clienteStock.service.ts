import { Database } from "../../db/client";
import { ClienteRepository } from "./cliente.repository";
import { ClienteStockRepository } from "./clienteStock.repository";

export type ClienteStockServiceDeps = {
    db: Database;
    repository: ClienteStockRepository;
    clienteRepository: ClienteRepository;
};

export function createClienteStockService({ db, repository, clienteRepository }: ClienteStockServiceDeps) {
    const getStock = async (clienteId: number, userId: number, fecha?: Date) => {
        const cliente = await clienteRepository.findOne({ id: clienteId, user: userId });

        return fecha === undefined ? repository.getStockActual(cliente.id) : repository.getStockAFecha(cliente.id, fecha);
    };

    // A diferencia del `Cliente.updatePrecios` actual, no lanza si ningún precio
    // estaba desactualizado (corrige el bug de `NothingChanged`, ver plan): si no
    // hay filas para sincronizar, simplemente no hace nada. La transacción
    // (leer precios desactualizados + grabar el historial + aplicarlos) es
    // responsabilidad del service, no del repository.
    const syncPrecios = async (clienteId: number, userId: number) => {
        const cliente = await clienteRepository.findOne({ id: clienteId, user: userId });

        await db.transaction(async (tx) => {
            const desactualizados = await repository.findPreciosDesactualizados(cliente.id, tx);
            if (desactualizados.length === 0) return;

            // Se graba el precio *nuevo* del libro en el historial, con el
            // timestamp de "ahora" (mismo comportamiento que el modelo MySQL
            // actual, ver plan "Decisiones y trade-offs").
            await repository.insertPrecioHistorial(
                desactualizados.map((d) => ({
                    id_libro: d.id_libro,
                    id_cliente: cliente.id,
                    precio: d.precio
                })),
                tx
            );

            for (const d of desactualizados) {
                await repository.updatePrecio(d.id_libro, cliente.id, d.precio, tx);
            }
        });

        return getStock(clienteId, userId);
    };

    return {
        getStock,
        syncPrecios,
        moveStock: repository.moveStock
    };
}

export type ClienteStockService = ReturnType<typeof createClienteStockService>;
