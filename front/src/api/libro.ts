import { api, toQueryString } from "./client";
import type { ListEnvelope } from "./client";
import type { Persona, TipoPersona } from "./persona";

// Refleja back/src/modules/libro/libro.schema.ts.
export type Libro = {
    id_libro: number;
    isbn: string;
    titulo: string;
    fecha_edicion: string;
    precio: number;
    stock: number | null;
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
};

export type PersonaEnLibro = Pick<Persona, "nombre" | "email"> & {
    id_persona: number;
    dni: string;
    tipo: TipoPersona;
    porcentaje: number;
};

export type LibroConPersonas = Libro & {
    autores: PersonaEnLibro[];
    ilustradores: PersonaEnLibro[];
};

export type CreateLibroInput = {
    isbn: string;
    titulo: string;
    fecha_edicion: string;
    precio: number;
    stock?: number;
    alto?: number;
    ancho?: number;
    largo?: number;
    brief?: string;
    paginas?: number;
    edad_recomendada?: number;
    book_trailer_url?: string;
};

export type UpdateLibroInput = Partial<CreateLibroInput>;

export type ListLibrosParams = {
    page?: number;
    pageSize?: number;
    titulo?: string;
    isbn?: string;
};

export const listLibros = (params: ListLibrosParams = {}): Promise<ListEnvelope<Libro>> => api.get(`/libro${toQueryString(params)}`);

export const getLibro = (isbn: string): Promise<{ success: true; data: LibroConPersonas }> => api.get(`/libro/${isbn}`);

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
