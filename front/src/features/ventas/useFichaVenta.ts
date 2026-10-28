import { useCallback, useEffect, useRef, useState } from "react";
import { getVenta } from "../../api/operaciones";
import type { VentaDetalle } from "../../api/operaciones";
import { getErrorMessage } from "../../lib/errors";

// Ficha de venta: el comprobante se muestra inline y, si la emisión falló, se
// reintenta desde su id sin volver a crear la venta.
export function useFichaVenta(id: number) {
    const [venta, setVenta] = useState<VentaDetalle | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    const requestId = useRef(0);

    useEffect(() => {
        const actual = ++requestId.current;
        setLoading(true);
        setError(null);

        getVenta(id)
            .then((response) => {
                if (actual === requestId.current) setVenta(response.data);
            })
            .catch((err) => {
                if (actual === requestId.current) {
                    setVenta(null);
                    setError(getErrorMessage(err));
                }
            })
            .finally(() => {
                if (actual === requestId.current) setLoading(false);
            });

        return () => {
            requestId.current += 1;
        };
    }, [id, reloadKey]);

    const refetch = useCallback(() => setReloadKey((actual) => actual + 1), []);

    return { venta, loading, error, refetch };
}
