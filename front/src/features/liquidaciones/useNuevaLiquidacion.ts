import { useState } from "react";
import { crearLiquidacion } from "../../api/liquidaciones";
import type { Liquidacion } from "../../api/liquidaciones";

export function useNuevaLiquidacion() {
    const [saving, setSaving] = useState(false);

    // La generación la decide el backend a partir del período: el preview no se
    // manda, sólo se mostró antes para revisar qué va a entrar.
    const crear = async (desde: string, hasta: string): Promise<Liquidacion> => {
        setSaving(true);
        try {
            return await crearLiquidacion(desde, hasta);
        } finally {
            setSaving(false);
        }
    };

    return { saving, crear };
}
