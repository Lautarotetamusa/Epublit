import { useCallback, useEffect, useState } from "react";
import { listLiquidaciones } from "../../api/liquidaciones";
import type { LiquidacionResumen } from "../../api/liquidaciones";

// Las liquidaciones ya generadas de la cuenta, más nuevas primero. Es un set
// acotado (una por período), así que la lectura no pagina — mismo criterio que
// `useMediosPago`.
export function useLiquidaciones() {
    const [liquidaciones, setLiquidaciones] = useState<LiquidacionResumen[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLiquidaciones = useCallback(async () => {
        setLoading(true);
        setLiquidaciones(await listLiquidaciones());
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchLiquidaciones();
    }, [fetchLiquidaciones]);

    return { liquidaciones, loading, refetch: fetchLiquidaciones };
}
