import { useCallback, useEffect, useState } from "react";
import { getPersona, updatePersona } from "../../api/persona";
import type { UpdatePersonaInput } from "../../api/persona";
import { getFotoMock, setFotoMock, removeFotoMock } from "./personaFotoMock";

export function useFichaPersona(id: number) {
    const [persona, setPersona] = useState<Awaited<ReturnType<typeof getPersona>>["data"] | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploadingFoto, setUploadingFoto] = useState(false);

    const fetchPersona = useCallback(async () => {
        const response = await getPersona(id);
        setPersona({ ...response.data, fotoUrl: response.data.fotoUrl ?? getFotoMock(id) });
    }, [id]);

    useEffect(() => {
        setLoading(true);
        fetchPersona().then(() => setLoading(false));
    }, [fetchPersona]);

    const update = async (input: UpdatePersonaInput) => {
        await updatePersona(id, input);
        await fetchPersona();
    };

    // La persona ya tiene que existir para poder tener foto (mismo criterio
    // que la portada de libro: se sube en un segundo paso, nunca en el
    // mismo request que la crea). Ver personaFotoMock.ts para por qué esto
    // no llama a ningún endpoint todavía.
    const uploadFoto = async (file: File) => {
        setUploadingFoto(true);
        try {
            const url = URL.createObjectURL(file);
            setFotoMock(id, url);
            await fetchPersona();
        } finally {
            setUploadingFoto(false);
        }
    };

    const removeFoto = async () => {
        removeFotoMock(id);
        await fetchPersona();
    };

    return { persona, loading, update, uploadFoto, uploadingFoto, removeFoto };
}
