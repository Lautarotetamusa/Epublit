import { api, toQueryString, ApiError } from "./client";
import type { ApiErrorItem } from "./client";
import type { MedioPago } from "./operaciones";

// Cliente real de depósitos, stock por depósito y movimientos (ver
// back/src/modules/deposito y back/src/modules/movimiento, y
// specs/008-movimientos-deposito/plan.md). Los tipos son la forma que necesita
// la pantalla; las rutas y los cuerpos siguen el contrato del backend.

export type Deposito = {
    id: number;
    nombre: string;
    descripcion: string | null;
    // Depósito principal del usuario: se crea solo, siempre existe y no se
    // puede eliminar.
    principal: boolean;
};

export type CreateDepositoInput = {
    nombre: string;
    descripcion?: string | null;
};

export type UpdateDepositoInput = {
    nombre: string;
    descripcion?: string | null;
};

// Un depósito con el resumen de lo que tiene adentro: lo que muestra el
// listado de depósitos sin tener que traer los libros de cada uno.
export type DepositoConStock = Deposito & {
    titulos: number;
    ejemplares: number;
};

// Un extremo de un movimiento. `exterior` es "afuera del sistema" y no tiene
// identificador. En un depósito, `nombre` viene resuelto porque el historial y
// el detalle lo muestran sin otra consulta (y un movimiento viejo tiene que
// seguir siendo legible aunque el depósito ya no exista).
export type Extremo = { tipo: "deposito"; id: number; nombre: string } | { tipo: "exterior" };

// Extremo como lo recibe quien registra el movimiento: acá todavía no hay
// nombre, sólo el identificador del depósito elegido.
export type ExtremoInput = { tipo: "deposito"; id: number } | { tipo: "exterior" };

// El tipo de un movimiento es explícito: ya no se deriva de sus extremos (ver
// specs/009-ledger-unificado). Una venta y una baja comparten depósito →
// exterior y sólo se distinguen por el tipo. Los tres primeros son los que
// registra el alta manual; el resto los generan las operaciones comerciales.
export type TipoMovimiento =
    | "ingreso"
    | "baja"
    | "transferencia"
    | "venta"
    | "consignacion"
    | "ventaConsignacion"
    | "devolucion";

// Los que puede registrar el alta manual (`POST /movimiento/`): el formulario
// se tipa con esto para no habilitar un tipo que el backend rechaza.
export type TipoMovimientoManual = "ingreso" | "baja" | "transferencia";

export type LineaMovimientoInput = {
    isbn: string;
    cantidad: number;
};

export type RegistrarMovimientoInput = {
    origen: ExtremoInput;
    destino: ExtremoInput;
    libros: LineaMovimientoInput[];
};

export type LibroEnMovimiento = {
    isbn: string;
    titulo: string;
    cantidad: number;
    // Precio unitario: sólo lo traen los movimientos comerciales.
    precio?: number;
};

// Cliente de una operación comercial; `null` en los movimientos manuales.
export type ClienteDeMovimiento = { id: number; nombre: string };

// Extensión de venta derivada del movimiento: existe sólo en `venta` y
// `ventaConsignacion`. `tipo_cbte` es el número de comprobante AFIP,
// `medio_pago` el objeto de la cuenta (el nombre sigue siendo legible aunque
// el medio esté dado de baja) y `descuento`/`total`/`neto` importes.
export type VentaDeMovimiento = {
    tipo_cbte: number;
    medio_pago: MedioPago | null;
    descuento: number | null;
    total: number;
    neto: number;
};

export type Movimiento = {
    id: number;
    fecha: string;
    tipo: TipoMovimiento;
    origen: Extremo;
    destino: Extremo;
    libros: LibroEnMovimiento[];
    cliente: ClienteDeMovimiento | null;
    // URL del comprobante/remito emitido, o `null` en los movimientos manuales.
    file_path: string | null;
    venta: VentaDeMovimiento | null;
};

// Página del historial: la paginación la resuelve el servidor.
export type PaginaMovimientos = {
    movimientos: Movimiento[];
    total: number;
    pagina: number;
    porPagina: number;
    totalPaginas: number;
};

// Cantidad de un libro dentro de un depósito concreto.
export type StockEnDeposito = {
    id: number;
    nombre: string;
    cantidad: number;
    principal: boolean;
    // Depósito propio de un cliente (stock consignado): `null` cuando es un
    // depósito del usuario. La ficha del libro los distingue para no linkear a
    // `/depositos/:id`, que daría 404.
    cliente_id: number | null;
};

// Desglose de un libro entre los depósitos donde tiene stock, más el total
// (que es justamente la suma del desglose).
export type DesgloseLibro = {
    total: number;
    depositos: StockEnDeposito[];
};

// Faltante de stock libro por libro con el que rechaza `POST /movimiento/`
// cuando el origen no alcanza. El `pedido` del backend se expone como `pedida`
// porque es lo que muestra la pantalla.
export type FaltanteStock = {
    isbn: string;
    titulo: string;
    pedida: number;
    disponible: number;
};

// El sobre de `GET /deposito/` no está paginado: trae todos los depósitos del
// usuario (incluido el principal) dentro de `data`.
export const listDepositos = (): Promise<{ success: true; data: DepositoConStock[] }> => api.get("/deposito");

export const getDeposito = (id: number): Promise<{ success: true; data: DepositoConStock }> => api.get(`/deposito/${id}`);

export const getDepositoLibros = (
    id: number
): Promise<{ success: true; data: { deposito: DepositoConStock; libros: LibroEnMovimiento[] } }> =>
    api.get(`/deposito/${id}/libros`);

export const createDeposito = (input: CreateDepositoInput): Promise<{ success: true; data: DepositoConStock }> =>
    api.post("/deposito", input);

export const updateDeposito = (id: number, input: UpdateDepositoInput): Promise<{ success: true; data: DepositoConStock }> =>
    api.put(`/deposito/${id}`, input);

// 204 sin body: no hay sobre `{ success }` que leer (ver plan, "Diseño de API").
export const deleteDeposito = (id: number): Promise<void> => api.del<void>(`/deposito/${id}`);

// Params del `GET /movimiento/`: los filtros viajan al backend (el listado
// pagina server-side, ver `PaginaMovimientos`), `deposito` matchea si el id es
// origen o destino y `hasta` es inclusivo.
export type ListMovimientosParams = {
    pagina?: number;
    porPagina?: number;
    tipo?: TipoMovimiento;
    deposito?: number;
    cliente?: number;
    desde?: string;
    hasta?: string;
};

export const listMovimientos = (
    params: ListMovimientosParams = {}
): Promise<{ success: true; data: PaginaMovimientos }> => api.get(`/movimiento${toQueryString(params)}`);

export const getMovimiento = (id: number): Promise<{ success: true; data: Movimiento }> => api.get(`/movimiento/${id}`);

export const createMovimiento = (input: RegistrarMovimientoInput): Promise<{ success: true; data: Movimiento }> =>
    api.post("/movimiento", input);

// Detalle del 409 por stock insuficiente. `ApiErrorItem` no declara los campos
// extra que el backend aplana en el mismo item del sobre (ver
// back/src/lib/http/errors.ts#StockInsuficiente); el intersection los vuelve
// opcionales, así que hay que validar que vengan.
type ItemStockInsuficiente = ApiErrorItem & {
    libros?: { isbn: string; titulo: string; pedido: number; disponible: number }[];
};

// Devuelve el detalle libro por libro si el error es el rechazo atómico por
// stock insuficiente, o `null` si es cualquier otro error (para poder distinguir
// el mensaje de "No se movió nada" del resto).
export function faltantesDeStock(error: unknown): FaltanteStock[] | null {
    if (!(error instanceof ApiError)) return null;

    const item: ItemStockInsuficiente | undefined = error.errors.find((e) => e.code === "StockInsuficiente");
    if (!item) return null;

    return (item.libros ?? []).map((libro) => ({
        isbn: libro.isbn,
        titulo: libro.titulo,
        pedida: libro.pedido,
        disponible: libro.disponible
    }));
}
