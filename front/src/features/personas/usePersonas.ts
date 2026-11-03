import { useCallback, useEffect, useRef, useState } from "react";
import { listPersonas, deletePersona } from "../../api/persona";
import type { Persona } from "../../api/persona";
import type { Rol } from "../../api/rol";
import type { Pagination } from "../../api/client";
import { getFotoMock } from "./personaFotoMock";

const PAGE_SIZE = 10;
const DEBOUNCE_MS = 300;

// `rol` es el rol de la cuenta por el que se filtra el listado (plan 011); sin
// rol, el listado trae todas las personas, incluidas las que no trabajan en
// ningún libro. El nombre se busca server-side: si se filtrara acá, sólo
// encontraría coincidencias dentro de la página visible.
export function usePersonas(rol: Rol | null) {
    const [personas, setPersonas] = useState<Persona[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [page, setPage] = useState(1);
    const [nombre, setNombre] = useState("");
    const [nombreBuscado, setNombreBuscado] = useState("");
    const [loading, setLoading] = useState(true);
    const requestId = useRef(0);

    // Sin debounce, cada tecla dispara una request. El término aplicado vuelve
    // a la página 1 porque la actual puede no existir en el resultado nuevo.
    useEffect(() => {
        const timer = window.setTimeout(() => {
            setNombreBuscado(nombre.trim());
            setPage(1);
        }, DEBOUNCE_MS);

        return () => window.clearTimeout(timer);
    }, [nombre]);

    const fetchPersonas = useCallback(async () => {
        const id = ++requestId.current;
        setLoading(true);

        try {
            const response = await listPersonas({
                rol: rol ?? undefined,
                nombre: nombreBuscado || undefined,
                page,
                pageSize: PAGE_SIZE
            });

            // Descarta respuestas viejas que lleguen fuera de orden.
            if (id !== requestId.current) return;

            // Merge con el mock local de foto (ver personaFotoMock.ts): el
            // listado real todavía no trae `fotoUrl` desde el backend.
            setPersonas(response.items.map((p) => ({ ...p, fotoUrl: p.fotoUrl ?? getFotoMock(p.id) })));
            setPagination(response.pagination);
        } catch {
            if (id === requestId.current) {
                setPersonas([]);
                setPagination(null);
            }
        } finally {
            if (id === requestId.current) setLoading(false);
        }
    }, [rol, nombreBuscado, page]);

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

    return { personas, pagination, page, setPage, loading, nombre, setNombre, remove };
}
