import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

// Búsqueda parcial, case-insensitive y sin distinguir acentos. Se aplica a
// ambos lados para que «Perez» encuentre «Pérez» y viceversa.
//
// Requiere la extensión `unaccent` de Postgres, instalada por la migración
// 0022_unaccent_search.sql. Sin ella, cualquier query que use este helper
// falla con "function unaccent(text) does not exist".
export function ilikeSinAcentos(column: SQLWrapper, value: string): SQL {
    return sql`unaccent(${column}) ilike unaccent(${`%${value}%`})`;
}

// Orden alfabético que no distingue mayúsculas ni acentos: «Álvarez» va con las
// A y «de la Fuente» con las D. El collation de la base no lo garantiza (en `C`
// las mayúsculas y las letras acentuadas quedan fuera de lugar).
export function ordenAlfabetico(column: SQLWrapper): SQL {
    return sql`lower(unaccent(${column}))`;
}
