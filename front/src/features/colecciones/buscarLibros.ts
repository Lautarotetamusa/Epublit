import { listLibros, updateLibro } from "../../api/libro";
import type { Libro } from "../../api/libro";
import type { Pagination } from "../../api/client";

// Búsqueda acotada contra el catálogo real, para el diálogo "Agregar libros".
//
// A propósito NO se trae el catálogo entero: se consulta por título o ISBN y
// de a una página (ver "Datos necesarios" en specs/007-colecciones/design.md).
// El filtro por título del backend es parcial (`ILIKE %…%`); el de ISBN es
// exacto, así que un ISBN incompleto no encuentra nada (se avisa en la ayuda
// del buscador).
//
// `sin_coleccion: true` hace que el backend devuelva sólo libros que no
// pertenecen a ninguna colección y que el total ya venga sin ellos: no hay
// que descartar nada en memoria (ver plan, tarea 13).
const ISBN_COMPLETO = /^[0-9-]{10,}$/;

export type ResultadoBusqueda = {
    items: Libro[];
    pagination: Pagination;
};

export async function buscarLibrosDelCatalogo(termino: string, page: number, pageSize: number): Promise<ResultadoBusqueda> {
    const filtro = ISBN_COMPLETO.test(termino) ? { isbn: termino } : { titulo: termino };
    const response = await listLibros({ ...filtro, sin_coleccion: true, page, pageSize });

    return { items: response.items, pagination: response.pagination };
}

// Asignar varios libros de una vez: cada asignación es un cambio de colección
// del libro (un libro está en una colección o en ninguna; asignar reemplaza).
export async function asignarLibrosAColeccion(idColeccion: number, isbns: string[]): Promise<void> {
    await Promise.all(isbns.map((isbn) => updateLibro(isbn, { coleccion_id: idColeccion })));
}
