import { useEffect, useState } from "react";
import { listarPaginasContenido } from "../../api/contenido";
import { mapearPaginaListado } from "./mapeoContenido";
import type { PaginaContenido } from "./tipos";

// El menú de la previsualización sale de las páginas publicadas; la página en
// edición la reemplaza el consumidor con su versión sin guardar. Si la lectura
// falla, el diálogo sigue mostrando la página actual: el menú es contexto, no
// contenido que deba romper la previsualización.
export function useMenuContenido(): PaginaContenido[] {
    const [paginas, setPaginas] = useState<PaginaContenido[]>([]);

    useEffect(() => {
        let cancelado = false;

        listarPaginasContenido({ estado: "publicadas" })
            .then((respuesta) => {
                if (!cancelado) setPaginas(respuesta.paginas.map(mapearPaginaListado));
            })
            .catch(() => {
                if (!cancelado) setPaginas([]);
            });

        return () => {
            cancelado = true;
        };
    }, []);

    return paginas;
}
