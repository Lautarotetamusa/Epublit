import { useCallback, useEffect, useState } from "react";
import { getPersona, updatePersona, uploadPersonaFoto, removePersonaFoto } from "../../api/persona";
import type { UpdatePersonaInput } from "../../api/persona";

export function useFichaPersona(id: number) {
    const [persona, setPersona] = useState<Awaited<ReturnType<typeof getPersona>>["data"] | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploadingFoto, setUploadingFoto] = useState(false);

    const fetchPersona = useCallback(async () => {
        const response = await getPersona(id);
        setPersona(response.data);
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
    // que la portada de libro: se sube en un segundo paso, nunca en el mismo
    // request que la crea).
    const uploadFoto = async (file: File) => {
        setUploadingFoto(true);
        try {
            await uploadPersonaFoto(id, file);
            await fetchPersona();
        } finally {
            setUploadingFoto(false);
        }
    };

    const removeFoto = async () => {
        await removePersonaFoto(id);
        await fetchPersona();
    };

    return { persona, loading, update, uploadFoto, uploadingFoto, removeFoto };
}
