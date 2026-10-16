import { api, toQueryString } from "./client";

// Cliente del panel de métricas de Inicio (ver specs/014-metricas-ventas). Todos
// los endpoints son de sólo lectura, requieren sesión y responden con el sobre
// `{ success, data }` (ver back/src/modules/metricas/metricas.controller.ts):
// acá se desenvuelve una sola vez para que el resto del front trabaje con los
// tipos de negocio y no con el sobre HTTP.

// Qué ventas entran en el panel. Mismo vocabulario que el backend
// (metricas.validator.ts): `firme` es la venta de stock propio y `consignacion`
// la venta imputada a stock que ya estaba consignado en un cliente.
export type AlcanceMetricas = "todas" | "firme" | "consignacion";

// Una cifra del período elegido y la misma cifra del período con el que se
// compara: el front calcula la variación a partir de las dos.
export type CifraComparada = { actual: number; anterior: number };

// El mes elegido, ya resuelto por el backend (el mes en curso se recorta a hoy).
export type PeriodoMetricas = { mes: string; desde: string; hasta: string; enCurso: boolean };

// El período contra el que se compara: mes anterior completo, o el mismo tramo
// de días si el mes elegido está en curso (`parcial`).
export type ComparacionMetricas = { mes: string; desde: string; hasta: string; parcial: boolean };

export type ResumenMetricas = {
    periodo: PeriodoMetricas;
    comparacion: ComparacionMetricas;
    cifras: {
        ingreso: CifraComparada;
        ejemplares: CifraComparada;
        ventas: CifraComparada;
        ejemplaresNuevos: CifraComparada;
    };
};

// Fila base de un corte. `porcionEjemplares`/`porcionIngreso` son fracciones
// 0–1 del total del mes (el front las convierte a 0–100 al armar la vista).
type FilaCorteMetricas = {
    ejemplares: number;
    ingreso: number;
    ventas: number;
    porcionEjemplares: number;
    porcionIngreso: number;
};

export type FilaTituloMetricas = FilaCorteMetricas & { isbn: string; titulo: string };

export type FilaClienteMetricas = FilaCorteMetricas & { idCliente: number; cliente: string };

// `idDeposito`/`deposito` pueden faltar si el movimiento no resolvió su origen
// (ver metricas.service.ts#SIN_DEPOSITO). `idCliente` viene con el dueño cuando
// `esDepositoCliente` es true (stock consignado): es lo que permite que la fila
// abra la ficha del cliente y no `/depositos/:id` (que da 404).
export type FilaDepositoMetricas = FilaCorteMetricas & {
    idDeposito: number | null;
    deposito: string | null;
    esDepositoCliente: boolean;
    idCliente: number | null;
};

// Los tres cortes del mes, completos y sin ordenar/paginar: el front ordena por
// la métrica elegida, pagina y exporta.
export type CortesMetricas = {
    titulo: FilaTituloMetricas[];
    cliente: FilaClienteMetricas[];
    deposito: FilaDepositoMetricas[];
};

// 12 puntos, del más viejo al más nuevo, el último es el mes elegido. `enCurso`
// marca que ese último punto es un mes a medias.
export type PuntoSerieMetricas = { mes: string; ingreso: number };

export type SerieMetricas = { enCurso: boolean; puntos: PuntoSerieMetricas[] };

export type PuntoMedioPagoMetricas = { medio: string; ingreso: number };

export type MediosPagoMetricas = { medios: PuntoMedioPagoMetricas[] };

// ------------------------------------------------ rutas

// Meses que el selector puede ofrecer (descendente, incluye el mes en curso
// aunque todavía no tenga movimientos).
export const listarMesesMetricas = (): Promise<string[]> =>
    api.get<{ success: true; data: { meses: string[] } }>("/metricas/meses").then((res) => res.data.meses);

export const getResumenMetricas = (mes: string, alcance: AlcanceMetricas): Promise<ResumenMetricas> =>
    api.get<{ success: true; data: ResumenMetricas }>(`/metricas/resumen${toQueryString({ mes, alcance })}`).then((res) => res.data);

export const getCortesMetricas = (mes: string, alcance: AlcanceMetricas): Promise<CortesMetricas> =>
    api.get<{ success: true; data: CortesMetricas }>(`/metricas/cortes${toQueryString({ mes, alcance })}`).then((res) => res.data);

export const getSerieMetricas = (mes: string, alcance: AlcanceMetricas): Promise<SerieMetricas> =>
    api.get<{ success: true; data: SerieMetricas }>(`/metricas/serie${toQueryString({ mes, alcance })}`).then((res) => res.data);

export const getMediosPagoMetricas = (mes: string, alcance: AlcanceMetricas): Promise<MediosPagoMetricas> =>
    api.get<{ success: true; data: MediosPagoMetricas }>(`/metricas/medios-pago${toQueryString({ mes, alcance })}`).then((res) => res.data);

// Cliente que consume el hook del panel. Se agrupa en un objeto para poder
// inyectarlo por parámetro (ver front/CLAUDE.md: DI en vez de importar el
// singleton dentro del hook) y para que el recambio back/front sea una línea.
export const metricasClient = {
    meses: listarMesesMetricas,
    resumen: getResumenMetricas,
    cortes: getCortesMetricas,
    serie: getSerieMetricas,
    mediosPago: getMediosPagoMetricas
};

export type MetricasClient = typeof metricasClient;
