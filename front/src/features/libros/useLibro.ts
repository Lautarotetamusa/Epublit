import { useCallback, useEffect, useState } from "react";
import { getLibro } from "../../api/libro";
import type { LibroConPersonas } from "../../api/libro";
import { getErrorMessage } from "../../lib/errors";

// Lectura de un libro por ISBN, compartida por la ficha (detalle) y la
// edición: las dos muestran el mismo libro, sólo cambia lo que hacen con él.
export function useLibro(isbn: string) {
    const [libro, setLibro] = useState<LibroConPersonas | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await getLibro(isbn);
            setLibro(response.data);
        } catch (err) {
            // Un libro inexistente o una red caída no puede dejar la pantalla
            // en loading para siempre: se libera el spinner y se muestra error.
            setLibro(null);
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }, [isbn]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { libro, loading, error, refetch };
}
