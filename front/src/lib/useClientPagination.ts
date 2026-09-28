import { useMemo, useState } from "react";

const DEFAULT_PAGE_SIZE = 10;

// Paginación en el cliente para listados que el backend siempre devuelve
// completos (cliente/venta/consignacion, a diferencia de libro/persona que
// sí paginan server-side — ver comentario en useClientes.ts). Comparte la
// misma UI (`Pagination` del design system) que los listados con paginación
// real: la diferencia es un detalle de implementación, no algo que la
// pantalla tenga que distinguir.
export function useClientPagination<T>(items: T[], pageSize = DEFAULT_PAGE_SIZE) {
    const [page, setPage] = useState(1);

    const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
    const clampedPage = Math.min(page, pageCount);

    const pageItems = useMemo(
        () => items.slice((clampedPage - 1) * pageSize, clampedPage * pageSize),
        [items, clampedPage, pageSize]
    );

    return { page: clampedPage, setPage, pageCount, pageItems, total: items.length };
}
