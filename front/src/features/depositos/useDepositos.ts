import { useState } from "react";
import type { Deposito, DepositoConStock, LibroEnMovimiento } from "../../api/deposito";
import { mockBuscarDeposito, mockListarDepositos, mockResumenDeposito, mockStockDeDeposito } from "./depositosMock";
import { useCatalogoParaStock } from "./useCatalogoParaStock";

// El mock es una estructura mutable: después de crear/editar/eliminar un
// depósito no hay un dato nuevo que guardar, hace falta forzar el re-render para
// volver a leerla.
function useRefresco() {
    const [, setRevision] = useState(0);
    return () => setRevision((actual) => actual + 1);
}

export function useDepositos() {
    const { catalogo, loading } = useCatalogoParaStock();
    const refetch = useRefresco();

    const depositos: DepositoConStock[] = mockListarDepositos().map((deposito) => ({
        ...deposito,
        ...mockResumenDeposito(deposito.id, catalogo)
    }));

    return { depositos, loading, refetch };
}

export function useDeposito(id: number) {
    const { catalogo, loading } = useCatalogoParaStock();
    const refetch = useRefresco();

    const deposito: Deposito | null = mockBuscarDeposito(id);
    const libros: LibroEnMovimiento[] = deposito ? mockStockDeDeposito(id, catalogo) : [];

    return {
        deposito,
        libros,
        ejemplares: libros.reduce((total, libro) => total + libro.cantidad, 0),
        loading,
        refetch
    };
}
