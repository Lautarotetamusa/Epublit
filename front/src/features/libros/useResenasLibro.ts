import { useCallback, useEffect, useState } from "react";
import { createResena, deleteResena, listResenas, updateResena } from "../../api/libro";
import type { Resena } from "../../api/libro";

// Cada escritura devuelve la lista desde el backend en vez de parchear el
// estado local: así el orden y los ids siempre son los persistidos.
export function useResenasLibro(isbn: string) {
    const [resenas, setResenas] = useState<Resena[]>([]);
    const [loading, setLoading] = useState(true);

    const refetch = useCallback(async () => {
        const response = await listResenas(isbn);
        setResenas(response.data);
        setLoading(false);
    }, [isbn]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    const crear = async (url: string) => {
        await createResena(isbn, url.trim());
        await refetch();
    };

    const editar = async (id: number, url: string) => {
        await updateResena(isbn, id, url.trim());
        await refetch();
    };

    const borrar = async (id: number) => {
        await deleteResena(isbn, id);
        await refetch();
    };

    return { resenas, loading, crear, editar, borrar };
}
