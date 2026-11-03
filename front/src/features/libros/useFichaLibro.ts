import { useTodasLasPersonas } from "./useTodasLasPersonas";
import { useColecciones } from "../colecciones/useColecciones";
import { useRoles } from "../roles/useRoles";
import { useLibro } from "./useLibro";
import { updateLibro, uploadLibroPortada } from "../../api/libro";
import type { UpdateLibroInput } from "../../api/libro";
import type { Rol } from "../../api/rol";
import { createPersona } from "../../api/persona";
import type { CreatePersonaInput } from "../../api/persona";
import { addLibroPersonas, updateLibroPersonas, removeLibroPersonas } from "../../api/libroPersona";

// Todo lo que necesita la pantalla de edición: el libro, las personas y roles
// de la cuenta y las operaciones que modifican la ficha. El detalle usa sólo
// `useLibro`, sin arrastrar esta maquinaria de escritura.
export function useFichaLibro(isbn: string) {
    const { libro, loading: loadingLibro, error, refetch: fetchLibro } = useLibro(isbn);
    const { personas, setPersonas, loading: loadingPersonas } = useTodasLasPersonas();
    const { colecciones, loading: loadingColecciones } = useColecciones();
    // Los roles con los que se puede asignar una persona al libro salen de la
    // cuenta (plan 011), no de un enum fijo.
    const { roles, loading: loadingRoles } = useRoles();

    const loading = loadingLibro || loadingPersonas || loadingColecciones || loadingRoles;
    // A qué colección pertenece el libro: lo resuelve el propio libro
    // (`coleccion_id`, ver specs/007-colecciones). `null` = sin colección.
    const idColeccion = libro?.coleccion_id ?? null;

    // La colección viaja en el payload del libro: el formulario siempre manda
    // el select (una colección o `null`), así que el PUT nunca la deja sin
    // tocar. La portada se sube aparte, con el libro ya actualizado.
    const update = async (input: UpdateLibroInput, portadaFile: File | null, idColeccion: number | null) => {
        await updateLibro(isbn, { ...input, coleccion_id: idColeccion });
        if (portadaFile) await uploadLibroPortada(isbn, portadaFile);
        await fetchLibro();
    };

    // `monto_acordado` es opcional: sin él la relación queda sin anticipo (o,
    // en la edición, conserva el que ya tenía).
    const agregarPersonaExistente = async (rol: Rol, id_persona: number, porcentaje: number, monto_acordado?: number) => {
        await addLibroPersonas(isbn, [{ id_persona, rol, porcentaje, monto_acordado }]);
        await fetchLibro();
    };

    const agregarPersonaNueva = async (rol: Rol, input: CreatePersonaInput, porcentaje: number, monto_acordado?: number) => {
        const created = await createPersona(input);
        await addLibroPersonas(isbn, [{ id_persona: created.data.id, rol, porcentaje, monto_acordado }]);
        setPersonas((current) => [...current, created.data]);
        await fetchLibro();
    };

    // El porcentaje siempre viaja (el backend lo exige presente), el anticipo
    // sólo cuando se pasa: omitido = se deja el valor actual de la relación.
    const actualizarRelacion = async (rol: Rol, id_persona: number, porcentaje: number, monto_acordado?: number) => {
        await updateLibroPersonas(isbn, [{ id_persona, rol, porcentaje, monto_acordado }]);
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
        actualizarRelacion,
        quitarPersona
    };
}
