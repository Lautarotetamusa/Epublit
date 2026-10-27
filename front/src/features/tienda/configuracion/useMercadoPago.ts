import { useCallback, useEffect, useState } from "react";
import {
    desconectarMercadoPago,
    getMercadoPago,
    getMercadoPagoConnectUrl
} from "../../../api/tienda";
import type { MercadoPagoStatus } from "../../../api/tienda";
import { getErrorMessage } from "../../../lib/errors";

export function useMercadoPago() {
    const [status, setStatus] = useState<MercadoPagoStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStatus = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await getMercadoPago();
            setStatus(response.data);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    // OAuth real: el backend devuelve la URL de autorización de MercadoPago y
    // la app sale del panel. Al volver, la sección lee el estado de nuevo.
    const conectar = async () => {
        const response = await getMercadoPagoConnectUrl();
        window.location.assign(response.data.url);
    };

    const desconectar = async () => {
        await desconectarMercadoPago();
        await fetchStatus();
    };

    return { status, loading, error, refetch: fetchStatus, conectar, desconectar };
}
