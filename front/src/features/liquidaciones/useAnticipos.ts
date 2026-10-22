import { useCallback, useEffect, useState } from "react";
import { listAnticipos, marcarAnticipoPagado } from "../../api/liquidaciones";
import type { Anticipo } from "../../api/liquidaciones";

export function useAnticipos() {
    const [anticipos, setAnticipos] = useState<Anticipo[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchAnticipos = useCallback(async () => {
        setLoading(true);
        setAnticipos(await listAnticipos());
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchAnticipos();
    }, [fetchAnticipos]);

    // El anticipo se paga de una sola vez: no hay monto parcial que mandar.
    const marcarPagado = async (idAnticipo: number) => {
        const actualizado = await marcarAnticipoPagado(idAnticipo);
        setAnticipos((actuales) => actuales.map((a) => (a.id === actualizado.id ? actualizado : a)));
    };

    return { anticipos, loading, marcarPagado };
}
