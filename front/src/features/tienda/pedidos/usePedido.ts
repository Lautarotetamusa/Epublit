import { useCallback, useEffect, useRef, useState } from "react";
import { getPedido } from "../../../api/tienda";
import type { PedidoDetalle } from "../../../api/tienda";
import { getErrorMessage } from "../../../lib/errors";

// Ficha de un pedido. `refetch` es lo que usan las acciones para traer el
// estado nuevo después de aceptar, rechazar, enviar, entregar o facturar.
export function usePedido(codigo: string) {
    const [pedido, setPedido] = useState<PedidoDetalle | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    const requestId = useRef(0);

    useEffect(() => {
        const id = ++requestId.current;
        setLoading(true);
        setError(null);

        getPedido(codigo)
            .then((response) => {
                if (id === requestId.current) setPedido(response);
            })
            .catch((err) => {
                if (id === requestId.current) {
                    setPedido(null);
                    setError(getErrorMessage(err));
                }
            })
            .finally(() => {
                if (id === requestId.current) setLoading(false);
            });

        return () => {
            requestId.current += 1;
        };
    }, [codigo, reloadKey]);

    const refetch = useCallback(() => setReloadKey((actual) => actual + 1), []);

    return { pedido, loading, error, refetch };
}
