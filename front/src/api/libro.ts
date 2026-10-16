import { api, toQueryString } from "./client";
import type { ListEnvelope } from "./client";
import type { Persona } from "./persona";
import type { Rol } from "./rol";
import type { StockEnDeposito } from "./deposito";

// Refleja back/src/modules/libro/libro.schema.ts.
export type Libro = {
    id_libro: number;
    isbn: string;
    titulo: string;
    fecha_edicion: string;
    precio: number;
    // Total calculado: la suma de las cantidades del libro en los depósitos.
    // Es de SÓLO LECTURA y vale 0 si el libro no tiene stock en ninguno: el
    // stock no se edita en el libro, se crea y se corrige con movimientos (ver
    // specs/008-movimientos-deposito/design.md).
    stock: number | null;
    // Cantidad del libro en el depósito principal: es contra lo que operan
    // venta en firme, consignación y devolución (a diferencia del total). Lo
    // informan `GET /libro`, `GET /libro/:isbn` y `GET /libro/lista_libros`
    // (ver specs/008-movimientos-deposito, tarea 7).
    disponible_principal: number;
    // Dimensiones en cm. Campos nuevos, todavía no soportados por el
    // backend (ver specs/003-libro-campos-extendidos/design.md).
    alto: number | null;
    ancho: number | null;
    largo: number | null;
    brief: string | null;
    paginas: number | null;
    // Años (edad mínima recomendada). Se muestra como "+<edad_recomendada> años".
    edad_recomendada: number | null;
    portada_url: string | null;
    book_trailer_url: string | null;
    // Colección a la que pertenece el libro (a lo sumo una). `coleccion_titulo`
    // lo resuelve el backend para no tener que cruzar el listado de
    // colecciones (ver specs/007-colecciones).
    coleccion_id: number | null;
    coleccion_titulo: string | null;
};

// Lo mínimo de un libro para resolver títulos y cantidades en las pantallas de
// stock y depósitos.
export type LibroBase = Pick<Libro, "isbn" | "titulo" | "stock">;

// Una persona que trabaja en el libro, con el rol de la cuenta con el que lo
// hace: el rol reemplaza al enum fijo `autor | ilustrador` (ver
// specs/011-roles/plan.md). La misma persona puede aparecer dos veces, con
// roles distintos.
export type PersonaEnLibro = Pick<Persona, "nombre" | "email"> & {
    id_persona: number;
    dni: string;
    rol: Rol;
    porcentaje: number;
};

export type LibroConPersonas = Libro & {
    personas: PersonaEnLibro[];
};

export type CreateLibroInput = {
    isbn: string;
    titulo: string;
    fecha_edicion: string;
    precio: number;
    // Sin stock: un libro nuevo arranca sin stock y se carga con un movimiento
    // de ingreso (el endpoint rechaza el campo si se manda).
    alto?: number;
    ancho?: number;
    largo?: number;
    brief?: string;
    paginas?: number;
    edad_recomendada?: number;
    book_trailer_url?: string;
    // `null` = sin colección; un id asigna/reemplaza la colección del libro
    // (ver specs/007-colecciones, "Pertenencia libro → colección").
    coleccion_id?: number | null;
};

export type UpdateLibroInput = Partial<CreateLibroInput>;

export type ListLibrosParams = {
    page?: number;
    pageSize?: number;
    titulo?: string;
    isbn?: string;
    // Con `true`, `GET /libro` devuelve sólo libros sin colección y el total
    // cuenta sólo esos: lo usa el diálogo "Agregar libros" (ver
    // specs/007-colecciones).
    sin_coleccion?: boolean;
};

export const listLibros = (params: ListLibrosParams = {}): Promise<ListEnvelope<Libro>> => api.get(`/libro${toQueryString(params)}`);

// El backend expone las personas del libro en una única lista, cada una con su
// rol de la cuenta (`{ id, nombre }`), ver specs/011-roles/tarea 11.
export const getLibro = (isbn: string): Promise<{ success: true; data: LibroConPersonas }> => api.get(`/libro/${isbn}`);

// Desglose del stock de un libro entre los depósitos del usuario donde tiene
// cantidad mayor a 0, más el total (la suma del desglose). Alimenta la tarjeta
// Stock de la ficha (ver specs/008-movimientos-deposito).
export type LibroDepositos = {
    isbn: string;
    total: number;
    depositos: StockEnDeposito[];
};

export const getLibroDepositos = (isbn: string): Promise<{ success: true; data: LibroDepositos }> =>
    api.get(`/libro/${isbn}/depositos`);

export const createLibro = (input: CreateLibroInput): Promise<{ success: true; data: Libro }> => api.post("/libro", input);

export const updateLibro = (isbn: string, input: UpdateLibroInput): Promise<{ success: true; data: Libro }> =>
    api.put(`/libro/${isbn}`, input);

export const deleteLibro = (isbn: string): Promise<{ success: true }> => api.del(`/libro/${isbn}`);

// Subida de portada: multipart, endpoint separado (mismo patrón que
// `POST /user/uploadCert`, ver back/src/modules/user/user.routes.ts). El
// libro tiene que existir antes de subirle portada (se sube después de
// crear/actualizar el resto de los campos). Ver "Datos necesarios" en
// specs/003-libro-campos-extendidos/design.md.
export const uploadLibroPortada = (isbn: string, file: File): Promise<{ success: true; data: { portada_url: string } }> =>
    api.postFile(`/libro/${isbn}/portada`, "portada", file);
