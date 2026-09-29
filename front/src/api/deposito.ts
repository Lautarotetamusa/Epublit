// Depósitos y movimientos todavía no existen en el backend (ver
// specs/008-movimientos-deposito/plan.md): este archivo es sólo la FORMA que
// necesita la pantalla, no un contrato de API. Nada de acá llama a la red: los
// datos los provee `features/depositos/depositosMock.ts` mientras no exista el
// backend. Cómo se expone cada dato (rutas, request/response, si pagina o
// filtra, dónde se guarda) es decisión del planner.

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
