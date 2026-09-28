import { useCallback, useEffect, useState } from "react";
import { listPersonas, deletePersona } from "../../api/persona";
import type { Persona, TipoPersona } from "../../api/persona";
import type { Pagination } from "../../api/client";
import { getFotoMock } from "./personaFotoMock";

const PAGE_SIZE = 10;

export function usePersonas(tipo: TipoPersona | undefined) {
    const [personas, setPersonas] = useState<Persona[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);

    const fetchPersonas = useCallback(async () => {
        setLoading(true);
        const response = await listPersonas({ tipo, page, pageSize: PAGE_SIZE });
        // Merge con el mock local de foto (ver personaFotoMock.ts): el
        // listado real todavía no trae `fotoUrl` desde el backend.
        setPersonas(response.items.map((p) => ({ ...p, fotoUrl: p.fotoUrl ?? getFotoMock(p.id) })));
        setPagination(response.pagination);
        setLoading(false);
    }, [tipo, page]);

    useEffect(() => {
        fetchPersonas();
    }, [fetchPersonas]);

    // Vuelve a la página 1 cuando cambia el rol filtrado: la página vieja
    // podría no existir en la lista nueva.
    useEffect(() => {
        setPage(1);
    }, [tipo]);

    const remove = async (id: number) => {
        await deletePersona(id);
        await fetchPersonas();
    };

    return { personas, pagination, page, setPage, loading, remove };
}
