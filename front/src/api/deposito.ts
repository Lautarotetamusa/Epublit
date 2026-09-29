import { api, toQueryString, ApiError } from "./client";
import type { ApiErrorItem } from "./client";

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

// Los tres casos que puede expresar un movimiento, derivados de sus extremos:
// exterior → depósito (entra stock), depósito → exterior (sale stock) y
// depósito → depósito (se mueve stock).
export type TipoMovimiento = "ingreso" | "baja" | "transferencia";

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
};

export type Movimiento = {
    id: number;
    fecha: string;
    origen: Extremo;
    destino: Extremo;
    libros: LibroEnMovimiento[];
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

export const listMovimientos = (
    params: { pagina?: number; porPagina?: number } = {}
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
