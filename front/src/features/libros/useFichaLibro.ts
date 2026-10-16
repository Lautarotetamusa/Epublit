import { useCallback, useEffect, useState } from "react";
import { getLibro, updateLibro, uploadLibroPortada } from "../../api/libro";
import type { LibroConPersonas, UpdateLibroInput } from "../../api/libro";
import type { Rol } from "../../api/rol";
import { createPersona } from "../../api/persona";
import type { CreatePersonaInput } from "../../api/persona";
import { addLibroPersonas, updateLibroPersonas, removeLibroPersonas } from "../../api/libroPersona";
import { getErrorMessage } from "../../lib/errors";
import { useTodasLasPersonas } from "./useTodasLasPersonas";
import { useColecciones } from "../colecciones/useColecciones";
import { useRoles } from "../roles/useRoles";

export function useFichaLibro(isbn: string) {
    const [libro, setLibro] = useState<LibroConPersonas | null>(null);
    const { personas, setPersonas, loading: loadingPersonas } = useTodasLasPersonas();
    const { colecciones, loading: loadingColecciones } = useColecciones();
    // Los roles con los que se puede asignar una persona al libro salen de la
    // cuenta (plan 011), no de un enum fijo.
    const { roles, loading: loadingRoles } = useRoles();
    // A qué colección pertenece el libro: lo devuelve el propio libro
    // (`coleccion_id`, ver specs/007-colecciones). `null` = sin colección.
    const [idColeccion, setIdColeccion] = useState<number | null>(null);
    const [loadingLibro, setLoadingLibro] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchLibro = useCallback(async () => {
        setLoadingLibro(true);
        setError(null);
        try {
            const response = await getLibro(isbn);
            // El `stock` del libro es el total de sus depósitos y
            // `disponible_principal` el del principal: ambos los calcula el backend
            // (ver specs/008-movimientos-deposito).
            setLibro(response.data);
            setIdColeccion(response.data.coleccion_id);
        } catch (err) {
            // Una request fallida (libro inexistente, red caída) no puede
            // dejar la pantalla en loading para siempre: se libera el spinner
            // y la ficha muestra el error.
            setLibro(null);
            setError(getErrorMessage(err));
        } finally {
            setLoadingLibro(false);
        }
    }, [isbn]);

    useEffect(() => {
        fetchLibro();
    }, [fetchLibro]);

    const loading = loadingLibro || loadingPersonas || loadingColecciones || loadingRoles;

    // La colección viaja en el payload del libro: el formulario siempre manda
    // el select (una colección o `null`), así que el PUT nunca la deja sin
    // tocar. La portada se sube aparte, con el libro ya actualizado.
    const update = async (input: UpdateLibroInput, portadaFile: File | null, idColeccion: number | null) => {
        await updateLibro(isbn, { ...input, coleccion_id: idColeccion });
        if (portadaFile) await uploadLibroPortada(isbn, portadaFile);
        await fetchLibro();
    };

    const agregarPersonaExistente = async (rol: Rol, id_persona: number, porcentaje: number) => {
        await addLibroPersonas(isbn, [{ id_persona, rol, porcentaje }]);
        await fetchLibro();
    };

    const agregarPersonaNueva = async (rol: Rol, input: CreatePersonaInput, porcentaje: number) => {
        const created = await createPersona(input);
        await addLibroPersonas(isbn, [{ id_persona: created.data.id, rol, porcentaje }]);
        setPersonas((current) => [...current, created.data]);
        await fetchLibro();
    };

    const actualizarPorcentaje = async (rol: Rol, id_persona: number, porcentaje: number) => {
        await updateLibroPersonas(isbn, [{ id_persona, rol, porcentaje }]);
        await fetchLibro();
    };

    const quitarPersona = async (rol: Rol, id_persona: number) => {
        await removeLibroPersonas(isbn, [{ id_persona, rol }]);
        await fetchLibro();
    };

    return {
        libro,
        personas,
        colecciones,
        roles,
        idColeccion,
        loading,
        error,
        update,
        agregarPersonaExistente,
        agregarPersonaNueva,
        actualizarPorcentaje,
        quitarPersona
    };
}
