import { useCallback, useEffect, useState } from "react";
import { listPersonas } from "../../api/persona";
import type { Persona } from "../../api/persona";

// El picker de autores/ilustradores (ficha de libro y alta de libro)
// necesita el universo completo de personas, no paginado: se comparte acá
// para no duplicar el fetch en los dos lugares.
export function useTodasLasPersonas() {
    const [personas, setPersonas] = useState<Persona[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchPersonas = useCallback(async () => {
        setLoading(true);
        const response = await listPersonas({ pageSize: 1000 });
        setPersonas(response.items);
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchPersonas();
    }, [fetchPersonas]);

    return { personas, setPersonas, loading };
}
