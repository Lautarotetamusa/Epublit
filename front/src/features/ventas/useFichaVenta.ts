import { useCallback, useEffect, useState } from "react";
import { getVenta } from "../../api/operaciones";
import type { VentaDetalle } from "../../api/operaciones";

export function useFichaVenta(id: number) {
    const [venta, setVenta] = useState<VentaDetalle | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchVenta = useCallback(async () => {
        setLoading(true);
        const response = await getVenta(id);
        setVenta(response.data);
        setLoading(false);
    }, [id]);

    useEffect(() => {
        fetchVenta();
    }, [fetchVenta]);

    return { venta, loading };
}
