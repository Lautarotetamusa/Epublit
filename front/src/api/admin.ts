import { api, toQueryString } from "./client";

// Cliente del panel de administración (ver specs/028-panel-admin-metricas).
// Todas las rutas requieren sesión con rol `admin`; una cuenta `editorial`
// recibe 403 `admin_required`, que el cliente HTTP distingue de una sesión
// inválida. Las respuestas exitosas devuelven el objeto directo (sin sobre).

export type PeriodoAdmin = { desde: string; hasta: string };

export type AdminResumen = {
    periodo: PeriodoAdmin;
    cuentas: number;
    nuevas30d: number;
    activas30d: number;
    conLibro: number;
    conVenta: number;
    arcaConectado: number;
};

export type AdminEtapasSerie = {
    soloRegistrado: number;
    cargoLibros: number;
    cargoMovimientos: number;
};

export type AdminPuntoSerie = {
    mes: string;
    total: number;
    etapas: AdminEtapasSerie;
};

export type AdminSerie = { puntos: AdminPuntoSerie[] };

export type EstadoCuenta = "activo" | "inactivo";
export type FiltroArcaCuenta = "con" | "sin";

// Fila del listado. Las fechas son `YYYY-MM-DD` en hora de Argentina o `null`.
export type AdminCuenta = {
    id: number;
    razonSocial: string;
    email: string | null;
    alta: string | null;
    ultimaOperacion: string | null;
    ultimoIngreso: string | null;
    operaciones30d: number;
    libros: number;
    ventas30d: number;
    arcaConectado: boolean;
    estado: EstadoCuenta;
    primeraFechaLibro: string | null;
    primeraFechaMovimiento: string | null;
    ventaHistorica: boolean;
};

export type AdminCuentasParams = {
    q?: string;
    estado?: EstadoCuenta;
    arca?: FiltroArcaCuenta;
    pagina?: number;
};

export type AdminListadoCuentas = {
    cuentas: AdminCuenta[];
    total: number;
    pagina: number;
    porPagina: number;
};

// ------------------------------------------------ rutas

export const getAdminResumen = (): Promise<AdminResumen> => api.get("/admin/resumen");

export const getAdminSerie = (): Promise<AdminSerie> => api.get("/admin/serie");

export const listAdminCuentas = (params: AdminCuentasParams = {}): Promise<AdminListadoCuentas> =>
    api.get(`/admin/cuentas${toQueryString(params)}`);
