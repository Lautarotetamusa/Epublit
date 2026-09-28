import { useCallback, useState } from "react";
import { generarLiquidacion } from "../../api/liquidacion";
import type { GenerarLiquidacionInput, Liquidacion } from "../../api/liquidacion";

export function useLiquidacion() {
    const [liquidacion, setLiquidacion] = useState<Liquidacion | null>(null);
    const [loading, setLoading] = useState(false);

    const generar = useCallback(async (input: GenerarLiquidacionInput) => {
        setLoading(true);
        const response = await generarLiquidacion(input);
        setLiquidacion(response.data);
        setLoading(false);
    }, []);

    const limpiar = useCallback(() => setLiquidacion(null), []);

    return { liquidacion, loading, generar, limpiar };
}
