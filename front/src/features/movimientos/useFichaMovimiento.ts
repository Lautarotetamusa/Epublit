import { useCallback, useEffect, useState } from "react";
import { getMovimiento } from "../../api/deposito";
import type { Movimiento } from "../../api/deposito";

export function useFichaMovimiento(id: number) {
    const [movimiento, setMovimiento] = useState<Movimiento | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchMovimiento = useCallback(async () => {
        setLoading(true);
        try {
            const response = await getMovimiento(id);
            setMovimiento(response.data);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchMovimiento();
    }, [fetchMovimiento]);

    return { movimiento, loading };
}
