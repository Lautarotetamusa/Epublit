import { useCallback, useEffect, useState } from "react";
import { listMediosPago } from "../../api/medioPago";
import type { MedioPago } from "../../api/operaciones";

// `GET /medio_pago/` devuelve todos los medios activos de la cuenta sin
// paginar (array pelado, ver api/medioPago.ts).
export function useMediosPago() {
    const [medios, setMedios] = useState<MedioPago[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchMedios = useCallback(async () => {
        setLoading(true);
        setMedios(await listMediosPago());
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchMedios();
    }, [fetchMedios]);

    return { medios, loading, refetch: fetchMedios };
}
