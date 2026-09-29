import { useCallback, useEffect, useState } from "react";
import { getDeposito, getDepositoLibros, listDepositos } from "../../api/deposito";
import { ApiError } from "../../api/client";
import type { DepositoConStock, LibroEnMovimiento } from "../../api/deposito";

// Listado de depósitos del usuario con su resumen (`titulos`/`ejemplares`), que
// ya resuelve el backend sin traer los libros de cada uno.
export function useDepositos() {
    const [depositos, setDepositos] = useState<DepositoConStock[]>([]);
    const [loading, setLoading] = useState(true);

    const refetch = useCallback(async () => {
        setLoading(true);
        try {
            const response = await listDepositos();
            setDepositos(response.data);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { depositos, loading, refetch };
}

// Ficha de un depósito: sus datos con resumen y el stock que tiene adentro
// (acotado a ese depósito, no el catálogo entero).
export function useDeposito(id: number) {
    const [deposito, setDeposito] = useState<DepositoConStock | null>(null);
    const [libros, setLibros] = useState<LibroEnMovimiento[]>([]);
    const [loading, setLoading] = useState(true);

    const refetch = useCallback(async () => {
        if (!Number.isFinite(id)) {
            setDeposito(null);
            setLibros([]);
            return;
        }

        try {
            const [depositoResponse, librosResponse] = await Promise.all([getDeposito(id), getDepositoLibros(id)]);
            setDeposito(depositoResponse.data);
            setLibros(librosResponse.data.libros);
        } catch (err) {
            // Un depósito inexistente (o de otro usuario) es un 404: la ficha
            // muestra el estado vacío en vez de romper.
            if (err instanceof ApiError && err.status === 404) {
                setDeposito(null);
                setLibros([]);
            } else {
                throw err;
            }
        }
    }, [id]);

    // `refetch` no toca `loading` (mismo criterio que useFichaColeccion): editar
    // o un rechazo al borrar releen sin reemplazar la ficha por el spinner.
    useEffect(() => {
        setLoading(true);
        refetch().finally(() => setLoading(false));
    }, [refetch]);

    return { deposito, libros, ejemplares: deposito?.ejemplares ?? 0, loading, refetch };
}
