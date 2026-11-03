import { useCallback, useEffect, useState } from "react";
import { listPersonas, deletePersona } from "../../api/persona";
import type { Persona } from "../../api/persona";
import type { Rol } from "../../api/rol";
import type { Pagination } from "../../api/client";

const PAGE_SIZE = 10;

// `rol` es el rol de la cuenta por el que se filtra el listado (plan 011); sin
// rol, el listado trae todas las personas, incluidas las que no trabajan en
// ningún libro.
export function usePersonas(rol: Rol | null) {
    const [personas, setPersonas] = useState<Persona[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);

    const fetchPersonas = useCallback(async () => {
        setLoading(true);
        const response = await listPersonas({ rol: rol ?? undefined, page, pageSize: PAGE_SIZE });
        setPersonas(response.items);
        setPagination(response.pagination);
        setLoading(false);
    }, [rol, page]);

    useEffect(() => {
        fetchPersonas();
    }, [fetchPersonas]);

    // Vuelve a la página 1 cuando cambia el rol filtrado: la página vieja
    // podría no existir en la lista nueva.
    useEffect(() => {
        setPage(1);
    }, [rol]);

    const remove = async (id: number) => {
        await deletePersona(id);
        await fetchPersonas();
    };

    return { personas, pagination, page, setPage, loading, remove };
}
