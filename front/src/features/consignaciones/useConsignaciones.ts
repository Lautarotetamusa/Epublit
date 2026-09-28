import { useCallback, useEffect, useState } from "react";
import { listConsignaciones } from "../../api/operaciones";
import type { Operacion } from "../../api/operaciones";

export function useConsignaciones() {
    const [consignaciones, setConsignaciones] = useState<Operacion[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchConsignaciones = useCallback(async () => {
        setLoading(true);
        const response = await listConsignaciones();
        setConsignaciones(response.data);
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchConsignaciones();
    }, [fetchConsignaciones]);

    return { consignaciones, loading, refetch: fetchConsignaciones };
}
