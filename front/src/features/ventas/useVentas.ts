import { useCallback, useEffect, useState } from "react";
import { listVentas } from "../../api/operaciones";
import type { Venta } from "../../api/operaciones";

// `GET /venta` no pagina (devuelve todo envuelto en `{success,data}`, ver
// back/src/modules/transaccion/transaccion.controller.ts): se pagina acá
// mismo del lado del cliente (ver useClientPagination).
export function useVentas() {
    const [ventas, setVentas] = useState<Venta[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchVentas = useCallback(async () => {
        setLoading(true);
        const response = await listVentas();
        setVentas(response.data);
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchVentas();
    }, [fetchVentas]);

    return { ventas, loading, refetch: fetchVentas };
}
