import { FilterMap } from "bradb";
import { eq, ilike, isNull, or, sql } from "drizzle-orm";
import { librosTable } from "./libro.schema";
import { stockDeLibro } from "./libro.stock";
import { libroValidator } from "./libro.validator";

export const libroFilterMap: FilterMap<typeof libroValidator.filter> = {
    user: (val) => eq(librosTable.user, val),
    isbn: (val) => eq(librosTable.isbn, val),
    titulo: (val) => ilike(librosTable.titulo, `%${val}%`),
    buscar: (val) => or(ilike(librosTable.titulo, `%${val}%`), ilike(librosTable.isbn, `%${val}%`))!,
    precio: (val) => eq(librosTable.precio, val),
    // El libro ya no tiene stock propio: filtrar por stock compara contra la
    // suma de sus cantidades en los depósitos (misma definición que `GET /libro`).
    stock: (val) => sql`${stockDeLibro()} = ${val}`,
    // `sin_coleccion=false` no filtra nada (el catálogo completo, como hoy):
    // devolver una condición siempre verdadera deja `buildFilters` intacto.
    sin_coleccion: (val) => (val ? isNull(librosTable.coleccion_id) : sql`true`)
};
