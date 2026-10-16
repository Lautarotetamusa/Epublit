import { useCallback, useEffect, useState } from "react";
import type { OperacionDetalle } from "../../api/operaciones";

type RespuestaOperacion = Promise<{ success: true; data: OperacionDetalle }>;

// Ficha de una operación (consignación o devolución): comparten el mismo sobre
// y el mismo detalle, así que el fetch vive una sola vez y cada página le pasa
// su `get*` de `api/operaciones`.
export function useOperacionDetalle(id: number, cargar: (id: number) => RespuestaOperacion) {
    const [operacion, setOperacion] = useState<OperacionDetalle | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchOperacion = useCallback(async () => {
        setLoading(true);
        try {
            const response = await cargar(id);
            setOperacion(response.data);
        } finally {
            setLoading(false);
        }
    }, [id, cargar]);

    useEffect(() => {
        fetchOperacion();
    }, [fetchOperacion]);

    return { operacion, loading };
}
