import { listLibrosDeColeccion } from "../../api/coleccion";
import type { ColeccionLibro } from "../../api/coleccion";
import { updateLibro } from "../../api/libro";

// La tabla de la ficha no pagina todavía, así que se pide una página amplia
// (mismo criterio que el resto del front para "necesito todos": el listado
// sigue acotado a la colección del lado del backend).
const PAGE_SIZE = 1000;

export async function fetchLibrosDeColeccion(idColeccion: number): Promise<ColeccionLibro[]> {
    const response = await listLibrosDeColeccion(idColeccion, { page: 1, pageSize: PAGE_SIZE });
    return response.items;
}

// Quitar un libro de la colección es cambiarle la colección a `null` desde el
// propio libro (ver specs/007-colecciones, "Pertenencia libro → colección").
export async function quitarLibroDeColeccion(isbn: string): Promise<void> {
    await updateLibro(isbn, { coleccion_id: null });
}
