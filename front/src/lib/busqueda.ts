// Normaliza texto para búsquedas locales: minúsculas y sin diacríticos.
// El backend hace lo equivalente con la extensión `unaccent` de Postgres
// (ver back/src/lib/sql/search.ts); esto cubre los listados que se filtran
// enteros en el cliente.
export function normalizarBusqueda(value: string): string {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
