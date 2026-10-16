import { api, toQueryString } from "./client";
import type {
    Excluida,
    LibroLiquidado,
    Liquidacion as ReporteLiquidacion,
    PersonaLiquidacionDetalle,
    PersonaLiquidada
} from "./liquidacion";
import type { Rol } from "./rol";

// La liquidación dejó de ser un reporte calculado al vuelo (ver
// specs/001-liquidacion-ventas) para ser una entidad que se genera, se guarda y
// se paga en partes (ver specs/012-liquidaciones-pagos). Este módulo es su
// contrato de datos contra el backend real
// (back/src/modules/liquidaciones/liquidaciones.service.ts); el reporte al vuelo
// sigue viviendo en `liquidacion.ts` y es lo que alimenta la previsualización de
// una liquidación nueva.

export type EstadoPago = "pendiente" | "parcial" | "pagada";

// Pago parcial de una persona. La ficha lo anida dentro de su persona, así que
// no trae `id_persona`: el dueño del pago ya es el contexto donde aparece.
export type Pago = {
    id: number;
    monto: number;
    fecha: string;
    nota: string | null;
};

// Una persona dentro de una liquidación generada: lo que se le debe (`total`),
// lo pagado, el saldo y el estado (ya derivado por el backend a partir de los
// pagos vigentes, no recalculado acá). `roles` son los roles con los que
// participa de los libros del período; `detalle` una línea por libro + rol.
export type PersonaAPagar = {
    id_persona: number;
    nombre: string;
    roles: Rol[];
    total: number;
    pagado: number;
    saldo: number;
    estado: EstadoPago;
    detalle: PersonaLiquidacionDetalle[];
    pagos: Pago[];
};

// La ficha completa de una liquidación generada (GET /liquidaciones/:id).
export type Liquidacion = {
    id: number;
    codigo: string;
    desde: string;
    hasta: string;
    fecha_generacion: string;
    total: number;
    pagado: number;
    saldo: number;
    estado: EstadoPago;
    personas: PersonaAPagar[];
};

// Fila del listado (GET /liquidaciones/): acá `personas` es la cantidad, no el
// array — el listado no carga la ficha entera.
export type LiquidacionResumen = Omit<Liquidacion, "personas"> & { personas: number };

export type RegistrarPagoInput = {
    monto: number;
    fecha: string;
    nota?: string;
};

// Una liquidación anterior que ya cubrió ventas del período: el reporte la
// informa agrupada por liquidación con la cantidad de movimientos que quedaron
// afuera (no una entrada por venta, ver back getExcluidas).
export type ExcluidaDePrevisualizacion = Excluida;

export type Previsualizacion = {
    desde: string;
    hasta: string;
    total: number;
    ejemplares: number;
    libros: LibroLiquidado[];
    personas: PersonaLiquidada[];
    excluidas: ExcluidaDePrevisualizacion[];
};

// El backend serializa `fecha_generacion` (columna timestamp) como ISO completo
// (`2026-07-01T00:00:00.000Z`), pero la UI formatea fechas `YYYY-MM-DD` (ver
// lib/fecha.ts): se recorta acá una sola vez, en el borde.
const normalizarFicha = (ficha: Liquidacion): Liquidacion => ({ ...ficha, fecha_generacion: ficha.fecha_generacion.slice(0, 10) });

// ---------------------------------------------------- liquidaciones (lectura)

// Array pelado (sin sobre `{success,data}`), igual que `GET /medio_pago/`.
export const listLiquidaciones = (): Promise<LiquidacionResumen[]> => api.get<LiquidacionResumen[]>("/liquidaciones/");

export const getLiquidacion = (id: number): Promise<Liquidacion> =>
    api.get<{ success: true; data: Liquidacion }>(`/liquidaciones/${id}`).then((res) => normalizarFicha(res.data));

// ---------------------------------------------------- generación (escritura)

// Previsualiza sin persistir: `GET /liquidacion` ya devuelve el reporte del
// período con las ventas liquidadas excluidas, así que acá sólo se adaptan los
// nombres del contrato del reporte (`total_facturado`/`ejemplares_vendidos`) a lo
// que muestra la pantalla. `total` es lo que se liquidará a las personas.
export async function previsualizarLiquidacion(desde: string, hasta: string): Promise<Previsualizacion> {
    const { data } = await api.get<{ success: true; data: ReporteLiquidacion }>(`/liquidacion${toQueryString({ desde, hasta })}`);

    return {
        desde,
        hasta,
        total: data.personas.reduce((suma, persona) => suma + persona.total_a_pagar, 0),
        ejemplares: data.ejemplares_vendidos,
        libros: data.libros,
        personas: data.personas,
        excluidas: data.excluidas
    };
}

export const crearLiquidacion = (desde: string, hasta: string): Promise<Liquidacion> =>
    api
        .post<{ success: true; data: Liquidacion }>("/liquidaciones/", { desde, hasta })
        .then((res) => normalizarFicha(res.data));

// ---------------------------------------------------- pagos

export const registrarPago = (idLiquidacion: number, idPersona: number, input: RegistrarPagoInput): Promise<Liquidacion> =>
    api
        .post<{ success: true; data: Liquidacion }>(`/liquidaciones/${idLiquidacion}/personas/${idPersona}/pagos`, input)
        .then((res) => normalizarFicha(res.data));

export const anularPago = (idLiquidacion: number, idPago: number): Promise<Liquidacion> =>
    api.del<{ success: true; data: Liquidacion }>(`/liquidaciones/${idLiquidacion}/pagos/${idPago}`).then((res) => normalizarFicha(res.data));

// ---------------------------------------------------- anticipos

// Forma cruda de `GET /anticipos/`: `rol` viene como string (`"autor"`) y el
// estado como booleano `pagado` (ver back anticipo.service.ts#PublicAnticipo).
type AnticipoApi = {
    id: number;
    id_libro: number;
    isbn: string;
    titulo: string;
    id_persona: number;
    nombre: string;
    id_rol: number;
    rol: string;
    monto: number;
    fecha_lanzamiento: string;
    reimpresiones: number;
    pagado: boolean;
    fecha_pago: string | null;
};

// El anticipo que cobra un rol al lanzarse un libro. Se genera una sola vez por
// libro + persona + rol: una reimpresión del mismo libro no genera otro. Se paga
// de una sola vez (no hay pagos parciales ni saldo): o está pendiente o está
// pagado. Tampoco se descuenta de las regalías: ver `Liquidacion`.
//
// La UI usa `rol` como `{ id, nombre }` (igual que el resto de roles) para
// compartir `tonoDeRol`/`nombreVisible`; el estado se lee directo de `pagado`.
export type Anticipo = {
    id: number;
    id_libro: number;
    isbn: string;
    titulo: string;
    id_persona: number;
    nombre: string;
    rol: Rol;
    monto: number;
    fecha_lanzamiento: string;
    reimpresiones: number;
    pagado: boolean;
    fecha_pago: string | null;
};

const aAnticipo = (raw: AnticipoApi): Anticipo => ({ ...raw, rol: { id: raw.id_rol, nombre: raw.rol } });

// Array pelado (sin sobre), igual que `GET /liquidaciones/`.
export const listAnticipos = (): Promise<Anticipo[]> => api.get<AnticipoApi[]>("/anticipos/").then((rows) => rows.map(aAnticipo));

// El anticipo se paga de una sola vez: no hay monto ni parciales que decidir, la
// acción es marcarlo como pagado (sin body).
export const marcarAnticipoPagado = (idAnticipo: number): Promise<Anticipo> =>
    api.post<{ success: true; data: AnticipoApi }>(`/anticipos/${idAnticipo}/pagar`).then((res) => aAnticipo(res.data));
