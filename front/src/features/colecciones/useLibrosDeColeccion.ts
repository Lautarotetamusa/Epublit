import { useCallback, useEffect, useState } from "react";
import type { ColeccionLibro } from "../../api/coleccion";
import { fetchLibrosDeColeccion } from "./librosDeColeccion";

// Los libros de una colección se piden acotados a esa colección (ver
// librosDeColeccion.ts): no se trae el catálogo entero para filtrarlo en
// memoria.
export function useLibrosDeColeccion(idColeccion: number) {
    const [libros, setLibros] = useState<ColeccionLibro[]>([]);
    const [loading, setLoading] = useState(true);

    const refetch = useCallback(async () => {
        setLoading(true);
        try {
            setLibros(await fetchLibrosDeColeccion(idColeccion));
        } finally {
            setLoading(false);
        }
    }, [idColeccion]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { libros, loading, refetch };
}
