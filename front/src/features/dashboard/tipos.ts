import type { AlcanceMetricas } from "../../api/metricas";

// Tipos de vista del panel de métricas de Inicio (ver
// specs/014-metricas-ventas). Los tipos del contrato HTTP viven en
// api/metricas.ts; acá quedan las formas que consumen los componentes.

// Qué ventas entran en el panel. Es el mismo vocabulario y el mismo valor que
// manda el backend en `alcance`, así que se reusa el tipo del cliente de API en
// vez de mantener dos listas de literales que se puedan desincronizar.
export type AlcanceVentas = AlcanceMetricas;

// Los tres cortes del ranking: por título, por depósito, por cliente.
export type Dimension = "titulo" | "deposito" | "cliente";

// Con qué se ordena el ranking y qué mide la barra del gráfico. Son las dos
// magnitudes del negocio: cuántos ejemplares salieron y cuánto dejaron.
export type Metrica = "ejemplares" | "ingreso";

// Fila del ranking, igual en los tres cortes: cambia la clave de agrupación y su
// etiqueta, el resto se calcula de la misma manera. Lleva las dos magnitudes y
// las dos porciones del total: ese cruce (muchos ejemplares / poco ingreso) es
// la lectura que el panel tiene que habilitar.
export type FilaDimension = {
    // isbn / id de depósito / id de cliente: con esto se arma el link a la ficha.
    clave: string;
    etiqueta: string;
    // Sólo lo usa el corte por título (el ISBN va debajo del título en la celda).
    isbn?: string;
    // Sólo lo usa el corte por depósito: marca el stock consignado en un cliente.
    depositoDeCliente?: boolean;
    // Sólo lo usa el corte por depósito: cuando el depósito es de un cliente, el
    // id de ese cliente, para poder abrir su ficha desde la fila.
    clienteId?: number;
    // Movimientos de venta distintos que incluyen esta fila.
    ventas: number;
    ejemplares: number;
    ingreso: number;
    // Porciones del total del mes, 0–100.
    porcentajeEjemplares: number;
    porcentajeIngreso: number;
};

// Las cuatro cifras del mes. Llegan calculadas por el backend por separado para
// el mes elegido y para el período comparado (`CifraComparada`), y acá se
// separan en las dos formas que renderiza el Overview.
export type ResumenPanel = {
    ingreso: number;
    ejemplares: number;
    ventas: number;
    // Ejemplares incorporados al stock en el mes. No depende del alcance de
    // venta: es producción, no comercialización.
    ejemplaresNuevos: number;
};

export type PuntoMensual = {
    // `yyyy-mm`, para ordenar; la etiqueta es la que se muestra.
    mes: string;
    etiqueta: string;
    ingreso: number;
};

export type PuntoMedioPago = {
    medio: string;
    ingreso: number;
};
