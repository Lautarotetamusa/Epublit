import { api, toQueryString } from "./client";

// Contrato real del CMS de contenido (ver back/src/modules/contenido y
// specs/020-cms-landing/plan.md). Las rutas admin usan el sobre estable
// `{error:{codigo,mensaje,detalles}}` para errores, pero las respuestas
// exitosas devuelven el recurso directo (`{pagina}`, `{paginas}`, etc.).

export type EstadoPaginaBackend = "borrador" | "publicada";

export type TipoBloqueBackend =
    | "hero"
    | "texto"
    | "imagen_texto"
    | "galeria"
    | "cita"
    | "datos"
    | "enlaces";

export type UsoImagen = "portada" | "hero" | "bloque" | "galeria";

export type ImagenBackend = {
    imagenId: number;
    url: string | null;
    textoAlternativo: string | null;
    epigrafe: string | null;
    ancho: number | null;
    alto: number | null;
};

export type DatoBackend = { valor: string; etiqueta: string };
export type EnlaceBackend = { nombre: string; destino: string; descripcion: string | null };

export type BloqueHeroBackend = {
    id: number;
    tipo: "hero";
    titulo: string;
    bajada: string;
    imagen: ImagenBackend | null;
};

export type BloqueTextoBackend = {
    id: number;
    tipo: "texto";
    titulo: string;
    contenido: string;
};

export type BloqueImagenTextoBackend = {
    id: number;
    tipo: "imagen_texto";
    titulo: string;
    texto: string;
    imagen: ImagenBackend | null;
    posicion: "izquierda" | "derecha";
};

export type BloqueGaleriaBackend = {
    id: number;
    tipo: "galeria";
    titulo: string;
    imagenes: ImagenBackend[];
    columnas: 2 | 3;
};

export type BloqueCitaBackend = {
    id: number;
    tipo: "cita";
    texto: string;
    autor: string;
    fuente: string | null;
};

export type BloqueDatosBackend = {
    id: number;
    tipo: "datos";
    titulo: string;
    items: DatoBackend[];
};

export type BloqueEnlacesBackend = {
    id: number;
    tipo: "enlaces";
    titulo: string;
    enlaces: EnlaceBackend[];
};

export type BloqueBackend =
    | BloqueHeroBackend
    | BloqueTextoBackend
    | BloqueImagenTextoBackend
    | BloqueGaleriaBackend
    | BloqueCitaBackend
    | BloqueDatosBackend
    | BloqueEnlacesBackend;

export type PaginaListadoBackend = {
    id: number;
    titulo: string;
    slug: string | null;
    descripcion: string | null;
    estado: EstadoPaginaBackend;
    visibleEnMenu: boolean;
    orden: number;
    cantidadBloques: number;
    actualizadaEn: string;
};

export type PaginaBackend = {
    id: number;
    titulo: string;
    slug: string | null;
    descripcion: string | null;
    estado: EstadoPaginaBackend;
    visibleEnMenu: boolean;
    orden: number;
    portada: ImagenBackend | null;
    bloques: BloqueBackend[];
    actualizadaEn: string;
    actualizadaPor: string;
};

export type ImagenSubidaBackend = {
    id: number;
    url: string;
    ancho: number;
    alto: number;
    mime: string;
    bytes: number;
};

// ---- Escritura -----------------------------------------------------------

export type ImagenReferenciaInput = {
    imagenId: number;
    textoAlternativo: string | null;
    epigrafe: string | null;
};

type BloqueInputBase = { id?: number };

export type BloqueHeroInput = BloqueInputBase & {
    tipo: "hero";
    titulo: string;
    bajada: string;
    imagen: ImagenReferenciaInput | null;
};

export type BloqueTextoInput = BloqueInputBase & {
    tipo: "texto";
    titulo: string;
    contenido: string;
};

export type BloqueImagenTextoInput = BloqueInputBase & {
    tipo: "imagen_texto";
    titulo: string;
    texto: string;
    imagen: ImagenReferenciaInput | null;
    posicion: "izquierda" | "derecha";
};

export type BloqueGaleriaInput = BloqueInputBase & {
    tipo: "galeria";
    titulo: string;
    imagenes: ImagenReferenciaInput[];
    columnas: 2 | 3;
};

export type BloqueCitaInput = BloqueInputBase & {
    tipo: "cita";
    texto: string;
    autor: string;
    fuente: string | null;
};

export type BloqueDatosInput = BloqueInputBase & {
    tipo: "datos";
    titulo: string;
    items: DatoBackend[];
};

export type BloqueEnlacesInput = BloqueInputBase & {
    tipo: "enlaces";
    titulo: string;
    enlaces: EnlaceBackend[];
};

export type BloqueInput =
    | BloqueHeroInput
    | BloqueTextoInput
    | BloqueImagenTextoInput
    | BloqueGaleriaInput
    | BloqueCitaInput
    | BloqueDatosInput
    | BloqueEnlacesInput;

export type PaginaInput = {
    titulo: string;
    slug: string | null;
    descripcion: string | null;
    visibleEnMenu: boolean;
    orden: number;
    portada: ImagenReferenciaInput | null;
    bloques: BloqueInput[];
};

// ---- Endpoints -----------------------------------------------------------

export type FiltroEstadoPaginas = "todas" | "publicadas" | "borradores";

export type ListPaginasParams = {
    estado?: FiltroEstadoPaginas;
    buscar?: string;
};

export type ConteosPaginas = {
    todas: number;
    publicadas: number;
    borradores: number;
};

export type ListPaginasResponse = {
    paginas: PaginaListadoBackend[];
    total: number;
    conteos: ConteosPaginas;
};

export type MotivoSlug = "libre" | "invalido" | "en_uso";

export type SlugDisponibleResponse = {
    disponible: boolean;
    motivo: MotivoSlug;
};

export const listarPaginasContenido = (params: ListPaginasParams = {}): Promise<ListPaginasResponse> => {
    const buscar = params.buscar?.trim();
    return api.get(
        `/contenido/paginas${toQueryString({
            estado: params.estado ?? "todas",
            buscar: buscar ? buscar : undefined
        })}`
    );
};

export const consultarSlugDisponible = (
    slug: string,
    paginaId?: number
): Promise<SlugDisponibleResponse> =>
    api.get(
        `/contenido/paginas/slug-disponible${toQueryString({
            slug,
            paginaId
        })}`
    );

export const obtenerPaginaContenido = (id: number): Promise<{ pagina: PaginaBackend }> =>
    api.get(`/contenido/paginas/${id}`);

export const crearPaginaContenido = (input: PaginaInput): Promise<{ pagina: PaginaBackend }> =>
    api.post("/contenido/paginas", input);

export const actualizarPaginaContenido = (
    id: number,
    input: PaginaInput
): Promise<{ pagina: PaginaBackend }> => api.put(`/contenido/paginas/${id}`, input);

export const eliminarPaginaContenido = (id: number): Promise<{ eliminada: true }> =>
    api.del(`/contenido/paginas/${id}`);

export const publicarPaginaContenido = (id: number): Promise<{ pagina: PaginaBackend }> =>
    api.post(`/contenido/paginas/${id}/publicar`);

export const despublicarPaginaContenido = (id: number): Promise<{ pagina: PaginaBackend }> =>
    api.post(`/contenido/paginas/${id}/despublicar`);

export const subirImagenContenido = (
    archivo: File,
    uso: UsoImagen
): Promise<{ imagen: ImagenSubidaBackend }> =>
    api.postFile("/contenido/imagenes", "archivo", archivo, { uso });

export const eliminarImagenContenido = (id: number): Promise<{ eliminada: true }> =>
    api.del(`/contenido/imagenes/${id}`);
