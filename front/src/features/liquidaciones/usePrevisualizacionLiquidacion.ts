import { useEffect, useState } from "react";
import { previsualizarLiquidacion } from "../../api/liquidaciones";
import type { Previsualizacion } from "../../api/liquidaciones";

// Lo que se va a liquidar, antes de generar. Se recalcula al cambiar el período
// (y no con un paso "generar → confirmar"): el período es el input y el estado
// es el preview.
export function usePrevisualizacionLiquidacion(desde: string, hasta: string) {
    const [previsualizacion, setPrevisualizacion] = useState<Previsualizacion | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!desde || !hasta || desde > hasta) {
            setPrevisualizacion(null);
            return;
        }

        // `vigente` evita que una respuesta lenta de un período viejo pise el
        // preview del período que el usuario ya eligió.
        let vigente = true;
        setLoading(true);
        previsualizarLiquidacion(desde, hasta).then((resultado) => {
            if (!vigente) return;
            setPrevisualizacion(resultado);
            setLoading(false);
        });

        return () => {
            vigente = false;
        };
    }, [desde, hasta]);

    return { previsualizacion, loading };
}
