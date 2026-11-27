// Modelo de la pantalla de administración. El origen sólo entrega cuentas
// habilitadas: no hay un campo de confirmación porque el panel no muestra ese
// estado y las cuentas no habilitadas quedan fuera del universo.

// Fila del listado ya mapeada al modelo de la UI. El estado viene derivado del
// backend (`operaciones30d > 0`), no se recalcula en el cliente.
export type UsuarioAdmin = {
    id: number;
    razonSocial: string;
    email: string;
    /** Fecha de alta (`YYYY-MM-DD`); null cuando el origen no la conoce. */
    fechaAlta: string | null;
    /** Última operación de negocio, no último ingreso. */
    ultimaOperacion: string | null;
    ultimoLogin: string | null;
    operaciones30d: number;
    libros: number;
    ventas30d: number;
    /** Certificado de producción cargado (criterio de producto). */
    arcaConectado: boolean;
    estado: "activo" | "inactivo";
};

export type ResumenCampana = {
    /** Universo del panel: cuentas habilitadas. */
    total: number;
    nuevas30d: number;
    activas30d: number;
    conLibro: number;
    conVenta: number;
    conArca: number;
};

export type ClavePaso = "cuentas" | "con-libro" | "con-venta";

export type PasoEmbudo = {
    clave: ClavePaso;
    label: string;
    cantidad: number;
};

// Composición acumulada de la base de cuentas en cada mes: cada cuenta cuenta
// una sola vez, en su etapa máxima alcanzada hasta el cierre de ese mes.
export type PuntoEtapas = {
    /** `YYYY-MM`. */
    mes: string;
    etiqueta: string;
    total: number;
    soloRegistrado: number;
    conLibros: number;
    conMovimientos: number;
    soloRegistradoPct: number;
    conLibrosPct: number;
    conMovimientosPct: number;
};

export type PeriodoPanel = { desde: string; hasta: string };

export type PanelAdmin = {
    resumen: ResumenCampana;
    embudo: PasoEmbudo[];
    etapas: PuntoEtapas[];
    periodo: PeriodoPanel;
};
