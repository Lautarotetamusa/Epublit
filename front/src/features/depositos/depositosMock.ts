import type {
    Deposito,
    Extremo,
    ExtremoInput,
    LibroEnMovimiento,
    Movimiento,
    RegistrarMovimientoInput,
    StockEnDeposito,
    UpdateDepositoInput
} from "../../api/deposito";
import type { LibroBase } from "../../api/libro";

// Los depósitos y sus movimientos todavía no existen en el backend (ver
// specs/008-movimientos-deposito/plan.md): esto simula la persistencia en
// memoria para poder probar el flujo completo —crear/editar/eliminar
// depósitos, mover libros entre ellos y consultar el historial— sin API.
// Es una decisión temporal de este mock, no una propuesta de cómo se guardan
// ni de cómo se exponen los datos: eso lo decide el planner.
//
// Modelo (el mismo de la historia): el libro NO tiene stock propio. El único
// stock que existe es la cantidad de un libro en un depósito, y sólo un
// movimiento la crea o la modifica.
//
// En esta pasada el mock es la única fuente de esas cantidades, pero los libros
// siguen viniendo de la API con su campo `stock` (todavía no migrado). Ese
// `stock` se usa como LÍNEA BASE del depósito principal: un libro sin entradas
// acá vive entero en el principal — que es exactamente el estado post-migración
// que describe el plan— y ni bien un movimiento lo toca, sus cantidades pasan a
// las de este store. Así el total que muestran catálogo y ficha (la suma) sigue
// siendo coherente con lo que devuelve `/libro` mientras el backend no existe.

type PorDeposito = Map<number, number>;

// Datos de muestra sintéticos: un depósito principal (el que se crea solo) y dos
// comunes, uno con stock y otro vacío, para poder ver las dos reglas de borrado.
const depositos: Deposito[] = [
    {
        id: 1,
        nombre: "Depósito central",
        descripcion: "Planta baja del edificio, junto al área de expedición.",
        principal: true
    },
    {
        id: 2,
        nombre: "Depósito Norte",
        descripcion: "Galpón de Av. Cabildo, entrepiso. Acceso por portón lateral.",
        principal: false
    },
    {
        id: 3,
        nombre: "Depósito Once",
        descripcion: null,
        principal: false
    }
];

let proximoIdDeposito = 4;

// isbn → (id de depósito → ejemplares). Sólo aparece acá lo que un movimiento ya
// tocó; el resto del catálogo vive implícitamente en el depósito principal.
const cantidades = new Map<string, PorDeposito>();

const EXTERIOR: Extremo = { tipo: "exterior" };

function depositoDe(id: number): Deposito {
    const deposito = depositos.find((d) => d.id === id);
    if (!deposito) throw new Error("El depósito no existe.");
    return deposito;
}

function extremoDe(id: number): Extremo {
    const deposito = depositoDe(id);
    return { tipo: "deposito", id: deposito.id, nombre: deposito.nombre };
}

// Movimientos de muestra, del más viejo al más nuevo (los ids siguen ese orden).
// Las cantidades son las que dejan los libros repartidos entre el principal y
// el Norte, con un ingreso y una baja para que los tres casos estén a la vista.
const movimientos: Movimiento[] = [
    {
        id: 1,
        fecha: new Date(Date.now() - 9 * 86400000).toISOString(),
        origen: extremoDe(1),
        destino: extremoDe(2),
        libros: [{ isbn: "9781000000011", titulo: "Breve historia del cine", cantidad: 10 }]
    },
    {
        id: 2,
        fecha: new Date(Date.now() - 6 * 86400000).toISOString(),
        origen: extremoDe(1),
        destino: extremoDe(2),
        libros: [
            { isbn: "9781000000004", titulo: "Poemas del sur", cantidad: 5 },
            { isbn: "9781000000006", titulo: "Relatos de invierno", cantidad: 12 }
        ]
    },
    {
        id: 3,
        fecha: new Date(Date.now() - 3 * 86400000).toISOString(),
        origen: extremoDe(1),
        destino: EXTERIOR,
        libros: [{ isbn: "9781000000005", titulo: "La casa vacía", cantidad: 8 }]
    },
    {
        id: 4,
        fecha: new Date(Date.now() - 1 * 86400000).toISOString(),
        origen: EXTERIOR,
        destino: extremoDe(1),
        libros: [{ isbn: "9781000000000", titulo: "El jardín de los senderos", cantidad: 30 }]
    }
];

let proximoIdMovimiento = movimientos.length + 1;

// Cantidades resultantes de esos movimientos de muestra.
cantidades.set(
    "9781000000011",
    new Map([
        [1, 15],
        [2, 10]
    ])
);
cantidades.set(
    "9781000000004",
    new Map([
        [1, 33],
        [2, 5]
    ])
);
cantidades.set(
    "9781000000006",
    new Map([
        [1, 38],
        [2, 12]
    ])
);
cantidades.set("9781000000005", new Map([[1, 35]]));
cantidades.set("9781000000000", new Map([[1, 49]]));

function materializar(isbn: string, apiStock: number): PorDeposito {
    const existente = cantidades.get(isbn);
    if (existente) return existente;

    // Primer contacto con el libro: se asienta la línea base en el principal
    // para poder sumarle o restarle sin perder el stock que ya informaba `/libro`.
    const porDeposito: PorDeposito = new Map([[mockDepositoPrincipal().id, apiStock]]);
    cantidades.set(isbn, porDeposito);
    return porDeposito;
}

// Cantidad de un libro en un depósito sin materializar nada: si el libro ya
// tiene entradas propias se leen de ahí; si no, todo su stock está en el
// principal (y en ningún otro).
function cantidadBase(deposito: Deposito, isbn: string, apiStock: number): number {
    const porDeposito = cantidades.get(isbn);
    if (!porDeposito) return deposito.principal ? apiStock : 0;
    return porDeposito.get(deposito.id) ?? 0;
}

function totalBase(isbn: string, apiStock: number): number {
    const porDeposito = cantidades.get(isbn);
    if (!porDeposito) return apiStock;
    let total = 0;
    for (const cantidad of porDeposito.values()) total += cantidad;
    return total;
}

export function mockDepositoPrincipal(): Deposito {
    const principal = depositos.find((d) => d.principal);
    // El modelo garantiza que siempre hay uno: un estado sin principal es un
    // bug, no un caso a mostrar.
    if (!principal) throw new Error("No hay depósito principal.");
    return principal;
}

export function mockListarDepositos(): Deposito[] {
    return [...depositos].sort(
        (a, b) => Number(b.principal) - Number(a.principal) || a.nombre.localeCompare(b.nombre, "es")
    );
}

export function mockBuscarDeposito(id: number): Deposito | null {
    return depositos.find((d) => d.id === id) ?? null;
}

export function mockCrearDeposito(input: { nombre: string; descripcion?: string | null }): Deposito {
    const deposito: Deposito = {
        id: proximoIdDeposito++,
        nombre: input.nombre.trim(),
        descripcion: input.descripcion?.trim() ? input.descripcion.trim() : null,
        principal: false
    };
    depositos.push(deposito);
    return deposito;
}

export function mockActualizarDeposito(id: number, input: UpdateDepositoInput): Deposito {
    const deposito = depositoDe(id);
    // El flag `principal` no es editable: no se toca acá ni en el alta.
    deposito.nombre = input.nombre.trim();
    deposito.descripcion = input.descripcion?.trim() ? input.descripcion.trim() : null;
    return deposito;
}

export function mockEliminarDeposito(id: number): void {
    const deposito = depositoDe(id);
    if (deposito.principal) throw new Error("El depósito principal no se puede eliminar.");

    // Un depósito común sólo tiene stock si está en el mapa de cantidades: lo
    // que nunca se movió vive en el principal (ver cantidadBase), así que acá
    // no hace falta el catálogo para saber si está vacío.
    if (mockResumenDeposito(id).ejemplares > 0) {
        throw new Error(`«${deposito.nombre}» todavía tiene stock. Movelo a otro depósito antes de eliminarlo.`);
    }

    depositos.splice(
        depositos.findIndex((d) => d.id === id),
        1
    );
}

// Total y desglose de un libro. `apiStock` es el stock que hoy informa `/libro`
// (la línea base del principal); ver comentario de arriba.
export function mockTotalDeLibro(isbn: string, apiStock: number): number {
    return totalBase(isbn, apiStock);
}

export function mockCantidadEnDeposito(idDeposito: number, isbn: string, apiStock: number): number {
    return cantidadBase(depositoDe(idDeposito), isbn, apiStock);
}

// Las operaciones que ya existían (venta, consignación, devolución) siguen
// descontando/sumando sobre el depósito principal (ver el plan), así que el
// "stock disponible" con el que operan es el del principal, no el total.
export function mockStockEnPrincipal(isbn: string, apiStock: number): number {
    return cantidadBase(mockDepositoPrincipal(), isbn, apiStock);
}

export function mockDesgloseDeLibro(isbn: string, apiStock: number): StockEnDeposito[] {
    return mockListarDepositos()
        .map((deposito) => ({
            id: deposito.id,
            nombre: deposito.nombre,
            cantidad: cantidadBase(deposito, isbn, apiStock),
            principal: deposito.principal
        }))
        .filter((deposito) => deposito.cantidad > 0)
        .sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre, "es"));
}

// Libros con stock en un depósito. El catálogo entero es necesario sólo para el
// principal, que es el que hereda el stock que nunca se movió.
export function mockStockDeDeposito(idDeposito: number, catalogo: LibroBase[]): LibroEnMovimiento[] {
    const deposito = depositoDe(idDeposito);
    return catalogo
        .map((libro) => ({
            isbn: libro.isbn,
            titulo: libro.titulo,
            cantidad: cantidadBase(deposito, libro.isbn, libro.stock ?? 0)
        }))
        .filter((libro) => libro.cantidad > 0)
        .sort((a, b) => b.cantidad - a.cantidad || a.titulo.localeCompare(b.titulo, "es"));
}

export function mockResumenDeposito(idDeposito: number, catalogo: LibroBase[] = []): { titulos: number; ejemplares: number } {
    const libros = mockStockDeDeposito(idDeposito, catalogo);
    return {
        titulos: libros.length,
        ejemplares: libros.reduce((total, libro) => total + libro.cantidad, 0)
    };
}

export function mockListarMovimientos(): Movimiento[] {
    return [...movimientos].sort((a, b) => b.fecha.localeCompare(a.fecha));
}

// Libro de un movimiento según el catálogo del momento. El movimiento guarda
// una copia (título incluido) así el historial no depende de que el libro siga
// existiendo.
function tituloDe(catalogo: LibroBase[], isbn: string): string {
    return catalogo.find((l) => l.isbn === isbn)?.titulo ?? isbn;
}

function libroDelCatalogo(catalogo: LibroBase[], isbn: string, cantidad: number): LibroEnMovimiento {
    return { isbn, titulo: tituloDe(catalogo, isbn), cantidad };
}

export type FaltanteStock = {
    isbn: string;
    titulo: string;
    pedida: number;
    disponible: number;
};

export type ResultadoMovimiento = { ok: true; movimiento: Movimiento } | { ok: false; faltantes: FaltanteStock[] };

// Registra un movimiento de varios libros. Es atómico: primero valida TODOS los
// libros contra el origen y sólo si no falta ninguno aplica los cambios, así que
// un rechazo no deja stock a medio mover ni un movimiento a medias en el
// historial. Cuando el origen es el exterior no hay saldo que validar.
export function mockRegistrarMovimiento(input: RegistrarMovimientoInput, catalogo: LibroBase[]): ResultadoMovimiento {
    const stockDe = (isbn: string) => catalogo.find((l) => l.isbn === isbn)?.stock ?? 0;
    const depositoOrigen = input.origen.tipo === "deposito" ? depositoDe(input.origen.id) : null;

    const faltantes: FaltanteStock[] = depositoOrigen
        ? input.libros
              .map((linea) => ({
                  isbn: linea.isbn,
                  titulo: tituloDe(catalogo, linea.isbn),
                  pedida: linea.cantidad,
                  disponible: cantidadBase(depositoOrigen, linea.isbn, stockDe(linea.isbn))
              }))
              .filter((linea) => linea.pedida > linea.disponible)
        : [];

    if (faltantes.length > 0) return { ok: false, faltantes };

    for (const linea of input.libros) {
        const porDeposito = materializar(linea.isbn, stockDe(linea.isbn));
        if (depositoOrigen) porDeposito.set(depositoOrigen.id, (porDeposito.get(depositoOrigen.id) ?? 0) - linea.cantidad);
        if (input.destino.tipo === "deposito") {
            porDeposito.set(input.destino.id, (porDeposito.get(input.destino.id) ?? 0) + linea.cantidad);
        }
    }

    const movimiento: Movimiento = {
        id: proximoIdMovimiento++,
        fecha: new Date().toISOString(),
        origen: resolverExtremo(input.origen),
        destino: resolverExtremo(input.destino),
        libros: input.libros.map((linea) => libroDelCatalogo(catalogo, linea.isbn, linea.cantidad))
    };
    movimientos.push(movimiento);

    return { ok: true, movimiento };
}

function resolverExtremo(extremo: ExtremoInput): Extremo {
    return extremo.tipo === "exterior" ? EXTERIOR : extremoDe(extremo.id);
}
