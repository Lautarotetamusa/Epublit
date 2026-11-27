import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../api/client";
import { getAdminResumen, getAdminSerie } from "../../api/admin";
import type { AdminResumen, AdminSerie } from "../../api/admin";
import { etiquetaMes } from "./fechas";
import type { PanelAdmin, PasoEmbudo, PuntoEtapas, ResumenCampana } from "./tipos";

export type EstadoPanel = "cargando" | "listo" | "error" | "sin-acceso";

function porcentajeDe(parte: number, total: number): number {
    return total === 0 ? 0 : (parte / total) * 100;
}

function unDecimal(valor: number): number {
    return Math.round(valor * 10) / 10;
}

function aResumen(resumen: AdminResumen): ResumenCampana {
    return {
        total: resumen.cuentas,
        nuevas30d: resumen.nuevas30d,
        activas30d: resumen.activas30d,
        conLibro: resumen.conLibro,
        conVenta: resumen.conVenta,
        conArca: resumen.arcaConectado
    };
}

// El embudo usa los mismos acumulados de toda la vida que el resumen: no hace
// falta una consulta extra a `/admin/embudo`.
function aEmbudo(resumen: ResumenCampana): PasoEmbudo[] {
    return [
        { clave: "cuentas", label: "Cuentas", cantidad: resumen.total },
        { clave: "con-libro", label: "Con al menos un libro", cantidad: resumen.conLibro },
        { clave: "con-venta", label: "Con al menos una venta", cantidad: resumen.conVenta }
    ];
}

function aEtapas(serie: AdminSerie): PuntoEtapas[] {
    return serie.puntos.map(({ mes, total, etapas }) => {
        const soloRegistradoPct = unDecimal(porcentajeDe(etapas.soloRegistrado, total));
        const conLibrosPct = unDecimal(porcentajeDe(etapas.cargoLibros, total));
        // El resto cierra en 100 para que el apilado no deje una franja vacía.
        const conMovimientosPct =
            total === 0 ? 0 : Math.max(0, unDecimal(100 - soloRegistradoPct - conLibrosPct));

        return {
            mes,
            etiqueta: etiquetaMes(mes),
            total,
            soloRegistrado: etapas.soloRegistrado,
            conLibros: etapas.cargoLibros,
            conMovimientos: etapas.cargoMovimientos,
            soloRegistradoPct,
            conLibrosPct,
            conMovimientosPct
        };
    });
}

// Un 403 `admin_required` no es una sesión vencida: la cuenta está autenticada
// pero no tiene rol de administración. El cliente HTTP ya no dispara el cierre
// de sesión para este caso; acá se traduce a un estado de acceso.
function esAccesoRestringido(error: unknown): boolean {
    return (
        error instanceof ApiError &&
        error.status === 403 &&
        error.errors.some((item) => item.code === "admin_required")
    );
}

export function usePanelAdmin() {
    const [estado, setEstado] = useState<EstadoPanel>("cargando");
    const [panel, setPanel] = useState<PanelAdmin | null>(null);
    const [intento, setIntento] = useState(0);

    const recargar = useCallback(() => {
        setEstado("cargando");
        setIntento((valor) => valor + 1);
    }, []);

    useEffect(() => {
        let vigente = true;

        Promise.all([getAdminResumen(), getAdminSerie()])
            .then(([resumen, serie]) => {
                if (!vigente) return;

                const resumenUi = aResumen(resumen);
                setPanel({
                    resumen: resumenUi,
                    embudo: aEmbudo(resumenUi),
                    etapas: aEtapas(serie),
                    periodo: resumen.periodo
                });
                setEstado("listo");
            })
            .catch((error: unknown) => {
                if (!vigente) return;
                setPanel(null);
                setEstado(esAccesoRestringido(error) ? "sin-acceso" : "error");
            });

        return () => {
            vigente = false;
        };
    }, [intento]);

    return { estado, panel, recargar };
}
