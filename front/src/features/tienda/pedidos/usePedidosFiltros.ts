import { useState } from "react";
import type { FormaEntrega, EstadoPedido } from "../../../api/tienda";

export type PedidosFiltrosState = {
    estado: EstadoPedido | "todos";
    busqueda: string;
    desde: string;
    hasta: string;
    entrega: FormaEntrega | "";
};

const filtrosVacios: PedidosFiltrosState = {
    estado: "todos",
    busqueda: "",
    desde: "",
    hasta: "",
    entrega: ""
};

// Estado de los filtros del listado. Cualquier cambio vuelve a la página 1:
// si el recorte nuevo tiene menos páginas, quedarse en la vieja mostraría
// una tabla vacía sin que el usuario haya cambiado de página.
export function usePedidosFiltros() {
    const [filtros, setFiltros] = useState<PedidosFiltrosState>(filtrosVacios);
    const [pagina, setPagina] = useState(1);

    const actualizar = (patch: Partial<PedidosFiltrosState>) => {
        setFiltros((actual) => ({ ...actual, ...patch }));
        setPagina(1);
    };

    const hayFiltrosActivos =
        filtros.estado !== "todos" ||
        filtros.busqueda.trim() !== "" ||
        filtros.desde !== "" ||
        filtros.hasta !== "" ||
        filtros.entrega !== "";

    return {
        filtros,
        pagina,
        setPagina,
        hayFiltrosActivos,
        setEstado: (estado: PedidosFiltrosState["estado"]) => actualizar({ estado }),
        setBusqueda: (busqueda: string) => actualizar({ busqueda }),
        setDesde: (desde: string) => actualizar({ desde }),
        setHasta: (hasta: string) => actualizar({ hasta }),
        setEntrega: (entrega: PedidosFiltrosState["entrega"]) => actualizar({ entrega }),
        limpiar: () => {
            setFiltros(filtrosVacios);
            setPagina(1);
        }
    };
}
