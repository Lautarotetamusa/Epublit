import { useEffect, useState } from "react";
import type { Libro } from "../../api/libro";
import type { Pagination } from "../../api/client";
import { buscarLibrosDelCatalogo } from "./buscarLibros";

// Chico a propósito: la búsqueda se resuelve de a una página contra la API, no
// trayendo el catálogo entero.
const PAGE_SIZE = 8;
const DEBOUNCE_MS = 350;

export function useBusquedaLibros() {
    const [termino, setTermino] = useState("");
    const [terminoBuscado, setTerminoBuscado] = useState("");
    const [page, setPage] = useState(1);
    const [items, setItems] = useState<Libro[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [loading, setLoading] = useState(false);

    // Sin debounce, cada tecla dispara una búsqueda. Término nuevo vuelve a la
    // página 1 (la actual puede no existir en el resultado nuevo): los dos
    // estados se actualizan juntos para que el efecto de abajo haga un solo
    // pedido.
    useEffect(() => {
        const timer = setTimeout(() => {
            setTerminoBuscado(termino.trim());
            setPage(1);
        }, DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [termino]);

    useEffect(() => {
        if (terminoBuscado === "") {
            setItems([]);
            setPagination(null);
            return;
        }

        // `vigente` descarta una respuesta vieja que llegue después de que el
        // usuario ya escribió otra cosa.
        let vigente = true;
        setLoading(true);
        buscarLibrosDelCatalogo(terminoBuscado, page, PAGE_SIZE)
            .then((resultado) => {
                if (!vigente) return;
                setItems(resultado.items);
                setPagination(resultado.pagination);
            })
            .finally(() => {
                if (vigente) setLoading(false);
            });

        return () => {
            vigente = false;
        };
    }, [terminoBuscado, page]);

    return {
        termino,
        setTermino,
        page,
        setPage,
        items,
        pagination,
        loading,
        // Distingue "todavía no buscó" de "buscó y no hay resultados".
        buscando: terminoBuscado !== ""
    };
}
