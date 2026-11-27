import { useCallback, useEffect, useState } from "react";
import { listAdminCuentas } from "../../api/admin";
import type { AdminCuenta, EstadoCuenta, FiltroArcaCuenta } from "../../api/admin";
import type { UsuarioAdmin } from "./tipos";

export type FiltroEstado = "todos" | "activos" | "inactivos";
export type FiltroArca = "todos" | "con-arca" | "sin-arca";

// El backend pagina de a 10 y filtra/pagina antes de devolver la página.
const CUENTAS_POR_PAGINA = 10;

function estadoApi(estado: FiltroEstado): EstadoCuenta | undefined {
    if (estado === "activos") return "activo";
    if (estado === "inactivos") return "inactivo";
    return undefined;
}

function arcaApi(arca: FiltroArca): FiltroArcaCuenta | undefined {
    if (arca === "con-arca") return "con";
    if (arca === "sin-arca") return "sin";
    return undefined;
}

function aUsuario(cuenta: AdminCuenta): UsuarioAdmin {
    return {
        id: cuenta.id,
        razonSocial: cuenta.razonSocial,
        email: cuenta.email ?? "",
        fechaAlta: cuenta.alta,
        ultimaOperacion: cuenta.ultimaOperacion,
        ultimoLogin: cuenta.ultimoIngreso,
        operaciones30d: cuenta.operaciones30d,
        libros: cuenta.libros,
        ventas30d: cuenta.ventas30d,
        arcaConectado: cuenta.arcaConectado,
        estado: cuenta.estado
    };
}

// La búsqueda, los filtros y la paginación se resuelven en el servidor: la
// tabla sólo dibuja la página que devuelve `GET /admin/cuentas`. Cada criterio
// vuelve a la primera página en el mismo evento para que el fetch no dispare
// una consulta intermedia con la página vieja.
export function useTablaCuentas() {
    const [busqueda, setBusquedaState] = useState("");
    const [estado, setEstadoState] = useState<FiltroEstado>("todos");
    const [arca, setArcaState] = useState<FiltroArca>("todos");
    const [page, setPageState] = useState(1);
    const [cuentas, setCuentas] = useState<UsuarioAdmin[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [intento, setIntento] = useState(0);

    const setBusqueda = useCallback((valor: string) => {
        setBusquedaState(valor);
        setPageState(1);
        setLoading(true);
        setError(false);
    }, []);

    const setEstado = useCallback((valor: FiltroEstado) => {
        setEstadoState(valor);
        setPageState(1);
        setLoading(true);
        setError(false);
    }, []);

    const setArca = useCallback((valor: FiltroArca) => {
        setArcaState(valor);
        setPageState(1);
        setLoading(true);
        setError(false);
    }, []);

    const setPage = useCallback((valor: number) => {
        setPageState(valor);
        setLoading(true);
        setError(false);
    }, []);

    const limpiar = useCallback(() => {
        setBusquedaState("");
        setEstadoState("todos");
        setArcaState("todos");
        setPageState(1);
        setLoading(true);
        setError(false);
    }, []);

    const recargar = useCallback(() => {
        setLoading(true);
        setError(false);
        setIntento((valor) => valor + 1);
    }, []);

    useEffect(() => {
        let vigente = true;

        listAdminCuentas({
            q: busqueda.trim() || undefined,
            estado: estadoApi(estado),
            arca: arcaApi(arca),
            pagina: page
        })
            .then((respuesta) => {
                if (!vigente) return;
                setCuentas(respuesta.cuentas.map(aUsuario));
                setTotal(respuesta.total);
                setLoading(false);
            })
            .catch(() => {
                if (!vigente) return;
                setCuentas([]);
                setTotal(0);
                setError(true);
                setLoading(false);
            });

        return () => {
            vigente = false;
        };
    }, [busqueda, estado, arca, page, intento]);

    // La exportación no tiene endpoint propio: se recorre el recorte filtrado
    // usando el total y el tamaño de página que informa el backend.
    const listarTodas = useCallback(async (): Promise<UsuarioAdmin[]> => {
        const filtros = {
            q: busqueda.trim() || undefined,
            estado: estadoApi(estado),
            arca: arcaApi(arca)
        };

        const primera = await listAdminCuentas({ ...filtros, pagina: 1 });
        const paginas = Math.ceil(primera.total / primera.porPagina);
        const restantes = await Promise.all(
            Array.from({ length: Math.max(0, paginas - 1) }, (_, indice) =>
                listAdminCuentas({ ...filtros, pagina: indice + 2 })
            )
        );

        return [primera, ...restantes].flatMap((respuesta) => respuesta.cuentas.map(aUsuario));
    }, [busqueda, estado, arca]);

    const hayFiltros = busqueda.trim() !== "" || estado !== "todos" || arca !== "todos";

    return {
        busqueda,
        setBusqueda,
        estado,
        setEstado,
        arca,
        setArca,
        cuentas,
        total,
        page,
        setPage,
        pageCount: Math.ceil(total / CUENTAS_POR_PAGINA),
        loading,
        error,
        recargar,
        hayFiltros,
        limpiar,
        listarTodas
    };
}
