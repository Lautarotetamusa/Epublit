import { useCallback, useEffect, useRef, useState } from "react";
import { getComprobante, reintentarComprobante } from "../../api/comprobantes";
import type { ComprobanteDTO } from "../../api/comprobantes";
import { getErrorMessage } from "../../lib/errors";

type UseComprobanteOptions = {
    // Las fichas no piden el documento de un comprobante pendiente o con
    // error: sólo hay algo para renderizar cuando está emitido.
    enabled?: boolean;
};

// Estado de lectura del documento completo. El resumen que traen las fichas
// no alcanza para el A4 (ítems, importes, CAE, QR), así que este hook pide el
// DTO sólo cuando hace falta.
export function useComprobante(id: number | null, { enabled = true }: UseComprobanteOptions = {}) {
    const [comprobante, setComprobante] = useState<ComprobanteDTO | null>(null);
    const [loading, setLoading] = useState(enabled && id !== null);
    const [error, setError] = useState<string | null>(null);
    const requestId = useRef(0);

    const cargar = useCallback(async () => {
        if (id === null) {
            setComprobante(null);
            setLoading(false);
            return;
        }

        const actual = ++requestId.current;
        setLoading(true);
        setError(null);

        try {
            const response = await getComprobante(id);
            if (actual === requestId.current) setComprobante(response.data);
        } catch (err) {
            if (actual === requestId.current) {
                setComprobante(null);
                setError(getErrorMessage(err));
            }
        } finally {
            if (actual === requestId.current) setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (!enabled) return;

        void cargar();
    }, [cargar, enabled]);

    return { comprobante, loading, error, refetch: cargar };
}

// El reintento cambia el mismo comprobante (no crea otro). Después de un
// `200`, `onExito` deja que la ficha vuelva a leer su resumen; un `409`/`502`
// queda como mensaje mostrable en el panel.
export function useReintentarComprobante(
    id: number | null,
    onExito?: () => void | Promise<void>
) {
    const [reintentando, setReintentando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const onExitoRef = useRef(onExito);

    useEffect(() => {
        onExitoRef.current = onExito;
    }, [onExito]);

    const reintentar = useCallback(async (): Promise<ComprobanteDTO | null> => {
        if (id === null) return null;

        setReintentando(true);
        setError(null);

        try {
            const response = await reintentarComprobante(id);
            await onExitoRef.current?.();
            return response.data;
        } catch (err) {
            setError(getErrorMessage(err));
            return null;
        } finally {
            setReintentando(false);
        }
    }, [id]);

    return { reintentar, reintentando, error };
}
