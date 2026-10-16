import { useCallback, useEffect, useState } from "react";
import { listDevoluciones } from "../../api/operaciones";
import type { Operacion } from "../../api/operaciones";

export function useDevoluciones() {
    const [devoluciones, setDevoluciones] = useState<Operacion[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchDevoluciones = useCallback(async () => {
        setLoading(true);
        const response = await listDevoluciones();
        setDevoluciones(response.data);
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchDevoluciones();
    }, [fetchDevoluciones]);

    return { devoluciones, loading };
}
