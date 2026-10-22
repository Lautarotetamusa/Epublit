import { useCallback, useEffect, useState } from "react";
import { deleteColeccion, getColeccion, removeColeccionPortada, updateColeccion, uploadColeccionPortada } from "../../api/coleccion";
import type { Coleccion, UpdateColeccionInput } from "../../api/coleccion";

export function useFichaColeccion(id: number) {
    const [coleccion, setColeccion] = useState<Coleccion | null>(null);
    const [loading, setLoading] = useState(true);

    const refetch = useCallback(async () => {
        const response = await getColeccion(id);
        setColeccion(response.data);
    }, [id]);

    useEffect(() => {
        setLoading(true);
        refetch().finally(() => setLoading(false));
    }, [refetch]);

    // Subir una portada nueva reemplaza la anterior; quitarla la deja en null.
    // Las dos acciones son endpoints propios: el PUT sólo toca título y
    // descripción.
    const update = async (input: UpdateColeccionInput, portadaFile: File | null, quitarPortada: boolean) => {
        await updateColeccion(id, input);
        if (portadaFile) await uploadColeccionPortada(id, portadaFile);
        else if (quitarPortada) await removeColeccionPortada(id);
        await refetch();
    };

    const remove = async () => {
        await deleteColeccion(id);
    };

    return { coleccion, loading, update, remove, refetch };
}
