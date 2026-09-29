import { useCallback, useEffect, useState } from "react";
import { getLibro, updateLibro, uploadLibroPortada } from "../../api/libro";
import type { LibroConPersonas, UpdateLibroInput } from "../../api/libro";
import { createPersona } from "../../api/persona";
import type { CreatePersonaInput, TipoPersona } from "../../api/persona";
import { addLibroPersonas, updateLibroPersonas, removeLibroPersonas } from "../../api/libroPersona";
import { useTodasLasPersonas } from "./useTodasLasPersonas";
import { useColecciones } from "../colecciones/useColecciones";
import { mockTotalDeLibro } from "../depositos/depositosMock";

export function useFichaLibro(isbn: string) {
    const [libro, setLibro] = useState<LibroConPersonas | null>(null);
    const { personas, setPersonas, loading: loadingPersonas } = useTodasLasPersonas();
    const { colecciones, loading: loadingColecciones } = useColecciones();
    // A qué colección pertenece el libro: lo devuelve el propio libro
    // (`coleccion_id`, ver specs/007-colecciones). `null` = sin colección.
    const [idColeccion, setIdColeccion] = useState<number | null>(null);
    const [loadingLibro, setLoadingLibro] = useState(true);

    const fetchLibro = useCallback(async () => {
        setLoadingLibro(true);
        const response = await getLibro(isbn);
        // El stock del libro es el total de sus depósitos: mientras el backend
        // no lo calcule (ver specs/008), el total sale del mock de movimientos,
        // que es el que cambia cuando se registra un movimiento.
        setLibro({ ...response.data, stock: mockTotalDeLibro(response.data.isbn, response.data.stock ?? 0) });
        setIdColeccion(response.data.coleccion_id);
        setLoadingLibro(false);
    }, [isbn]);

    useEffect(() => {
        fetchLibro();
    }, [fetchLibro]);

    const loading = loadingLibro || loadingPersonas || loadingColecciones;

    // La colección viaja en el payload del libro: el formulario siempre manda
    // el select (una colección o `null`), así que el PUT nunca la deja sin
    // tocar. La portada se sube aparte, con el libro ya actualizado.
    const update = async (input: UpdateLibroInput, portadaFile: File | null, idColeccion: number | null) => {
        await updateLibro(isbn, { ...input, coleccion_id: idColeccion });
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

    return {
        libro,
        personas,
        colecciones,
        idColeccion,
        loading,
        update,
        agregarPersonaExistente,
        agregarPersonaNueva,
        actualizarPorcentaje,
        quitarPersona
    };
}
