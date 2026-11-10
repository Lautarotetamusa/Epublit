import { useCallback, useEffect, useState } from "react";
import { listarPaginasContenido } from "../../api/contenido";
import type { ConteosPaginas, FiltroEstadoPaginas } from "../../api/contenido";
import { mensajeDeError } from "./erroresContenido";
import { mapearPaginaListado } from "./mapeoContenido";
import type { PaginaContenido } from "./tipos";

export type { FiltroEstadoPaginas };

const CONTEOS_VACIOS: ConteosPaginas = { todas: 0, publicadas: 0, borradores: 0 };

const ESPERA_BUSQUEDA_MS = 300;

// El listado lo resuelve el backend, incluidos los filtros, los conteos y el
// orden (orden ascendente y, en empate, título). La búsqueda se espera un
// instante para no disparar una request por tecla. Al volver del editor la
// pantalla se monta de nuevo y relee, así que no hace falta invalidar nada.
export function usePaginasContenido() {
    const [paginas, setPaginas] = useState<PaginaContenido[]>([]);
    const [conteos, setConteos] = useState<ConteosPaginas>(CONTEOS_VACIOS);
    const [filtro, setFiltro] = useState<FiltroEstadoPaginas>("todas");
    const [busqueda, setBusqueda] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [recarga, setRecarga] = useState(0);

    useEffect(() => {
        let cancelado = false;
        const timer = setTimeout(
            () => {
                setLoading(true);
                setError(null);

                listarPaginasContenido({ estado: filtro, buscar: busqueda })
                    .then((respuesta) => {
                        if (cancelado) return;
                        setPaginas(respuesta.paginas.map(mapearPaginaListado));
                        setConteos(respuesta.conteos);
                    })
                    .catch((err: unknown) => {
                        if (!cancelado) setError(mensajeDeError(err));
                    })
                    .finally(() => {
                        if (!cancelado) setLoading(false);
                    });
            },
            busqueda.trim() === "" ? 0 : ESPERA_BUSQUEDA_MS
        );

        return () => {
            cancelado = true;
            clearTimeout(timer);
        };
    }, [filtro, busqueda, recarga]);

    const recargar = useCallback(() => setRecarga((valor) => valor + 1), []);

    return {
        paginas,
        visibles: paginas,
        filtro,
        setFiltro,
        busqueda,
        setBusqueda,
        conteos,
        loading,
        error,
        recargar
    };
}
