import { useCallback, useEffect, useState } from "react";
import { listColecciones } from "../../api/coleccion";
import type { Coleccion } from "../../api/coleccion";

// Listado de colecciones para el selector de la ficha de libro y para la
// pantalla de colecciones. `GET /coleccion/` no está paginado: trae todas las
// colecciones del usuario dentro de `data`.
export function useColecciones() {
    const [colecciones, setColecciones] = useState<Coleccion[]>([]);
    const [loading, setLoading] = useState(true);

    const refetch = useCallback(async () => {
        setLoading(true);
        try {
            const response = await listColecciones();
            setColecciones(response.data);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { colecciones, loading, refetch };
}
