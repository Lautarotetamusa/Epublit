import { useCallback, useEffect, useState } from "react";
import { getLibro, updateLibro, uploadLibroPortada } from "../../api/libro";
import type { LibroConPersonas, UpdateLibroInput } from "../../api/libro";
import { createPersona } from "../../api/persona";
import type { CreatePersonaInput, TipoPersona } from "../../api/persona";
import { addLibroPersonas, updateLibroPersonas, removeLibroPersonas } from "../../api/libroPersona";
import { useTodasLasPersonas } from "./useTodasLasPersonas";

export function useFichaLibro(isbn: string) {
    const [libro, setLibro] = useState<LibroConPersonas | null>(null);
    const { personas, setPersonas, loading: loadingPersonas } = useTodasLasPersonas();
    const [loadingLibro, setLoadingLibro] = useState(true);

    const fetchLibro = useCallback(async () => {
        setLoadingLibro(true);
        const response = await getLibro(isbn);
        setLibro(response.data);
        setLoadingLibro(false);
    }, [isbn]);

    useEffect(() => {
        fetchLibro();
    }, [fetchLibro]);

    const loading = loadingLibro || loadingPersonas;

    const update = async (input: UpdateLibroInput, portadaFile: File | null) => {
        await updateLibro(isbn, input);
        if (portadaFile) await uploadLibroPortada(isbn, portadaFile);
        await fetchLibro();
    };

    const agregarPersonaExistente = async (tipo: TipoPersona, id_persona: number, porcentaje: number) => {
        await addLibroPersonas(isbn, [{ id_persona, tipo, porcentaje }]);
        await fetchLibro();
    };

    const agregarPersonaNueva = async (tipo: TipoPersona, input: CreatePersonaInput, porcentaje: number) => {
        const created = await createPersona(input);
        await addLibroPersonas(isbn, [{ id_persona: created.data.id, tipo, porcentaje }]);
        setPersonas((current) => [...current, created.data]);
        await fetchLibro();
    };

    const actualizarPorcentaje = async (tipo: TipoPersona, id_persona: number, porcentaje: number) => {
        await updateLibroPersonas(isbn, [{ id_persona, tipo, porcentaje }]);
        await fetchLibro();
    };

    const quitarPersona = async (tipo: TipoPersona, id_persona: number) => {
        await removeLibroPersonas(isbn, [{ id_persona, tipo }]);
        await fetchLibro();
    };

    return { libro, personas, loading, update, agregarPersonaExistente, agregarPersonaNueva, actualizarPorcentaje, quitarPersona };
}
