import { erroresAdmin } from "./admin.errors";

export type EstadoCuenta = "activo" | "inactivo";
export type FiltroArca = "con" | "sin";

export type FiltrosCuentas = {
    q?: string;
    estado?: EstadoCuenta;
    arca?: FiltroArca;
    pagina: number;
};

export const POR_PAGINA = 10;

// Express entrega los query params como string, string[] o undefined según
// cómo vengan; el panel sólo acepta un valor simple.
const leerParametro = (valor: unknown): string | undefined => {
    if (typeof valor === "string") return valor;
    if (Array.isArray(valor) && typeof valor[0] === "string") return valor[0];
    return undefined;
};

const parsearEstado = (valor: unknown): EstadoCuenta | undefined => {
    const estado = leerParametro(valor)?.trim();
    if (!estado) return undefined;
    if (estado === "activo" || estado === "inactivo") return estado;

    throw erroresAdmin.estadoInvalido();
};

const parsearArca = (valor: unknown): FiltroArca | undefined => {
    const arca = leerParametro(valor)?.trim();
    if (!arca) return undefined;
    if (arca === "con" || arca === "sin") return arca;

    throw erroresAdmin.arcaInvalido();
};

const parsearPagina = (valor: unknown): number => {
    const pagina = leerParametro(valor)?.trim();
    if (!pagina) return 1;
    if (!/^\d+$/.test(pagina) || Number(pagina) < 1) throw erroresAdmin.paginaInvalida();

    return Number(pagina);
};

const parsearBusqueda = (valor: unknown): string | undefined => {
    const q = leerParametro(valor)?.trim();
    return q ? q : undefined;
};

export const adminValidator = {
    listado: (query: Record<string, unknown>): FiltrosCuentas => ({
        q: parsearBusqueda(query.q),
        estado: parsearEstado(query.estado),
        arca: parsearArca(query.arca),
        pagina: parsearPagina(query.pagina)
    })
};
