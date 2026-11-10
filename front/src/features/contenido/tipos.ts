// Modelo de contenido institucional de la landing. Estos tipos describen lo
// que la editora ve en el panel; el contrato real del backend y su traducción
// viven en `src/api/contenido.ts` y `mapeoContenido.ts`.

export type EstadoPagina = "borrador" | "publicada";

export type ImagenContenido = {
    /** Identidad de la colocación en el editor (una misma imagen puede estar en dos lados). */
    id: string;
    /** Id del archivo en el backend. `null` mientras no se subió. */
    imagenId: number | null;
    /** URL de la imagen ya subida, o un objectURL mientras se previsualiza. */
    url: string;
    alt: string;
    epigrafe: string;
    ancho: number | null;
    alto: number | null;
    /** La subida está en curso: bloquear guardar/publicar hasta que termine. */
    subiendo: boolean;
};

export type TipoBloque = "hero" | "texto" | "imagen-texto" | "galeria" | "cita" | "datos" | "enlaces";

type BloqueBase = { id: string };

export type BloqueHero = BloqueBase & {
    tipo: "hero";
    titulo: string;
    bajada: string;
    imagen: ImagenContenido | null;
};

export type BloqueTexto = BloqueBase & {
    tipo: "texto";
    titulo: string;
    contenido: string;
};

export type BloqueImagenTexto = BloqueBase & {
    tipo: "imagen-texto";
    titulo: string;
    texto: string;
    imagen: ImagenContenido | null;
    posicion: "izquierda" | "derecha";
};

export type BloqueGaleria = BloqueBase & {
    tipo: "galeria";
    titulo: string;
    imagenes: ImagenContenido[];
    columnas: 2 | 3;
};

export type BloqueCita = BloqueBase & {
    tipo: "cita";
    texto: string;
    autor: string;
    fuente: string;
};

export type DatoEstadistico = { id: string; valor: string; etiqueta: string };

export type BloqueDatos = BloqueBase & {
    tipo: "datos";
    titulo: string;
    items: DatoEstadistico[];
};

export type EnlaceContenido = { id: string; etiqueta: string; href: string; descripcion: string };

export type BloqueEnlaces = BloqueBase & {
    tipo: "enlaces";
    titulo: string;
    items: EnlaceContenido[];
};

export type Bloque =
    | BloqueHero
    | BloqueTexto
    | BloqueImagenTexto
    | BloqueGaleria
    | BloqueCita
    | BloqueDatos
    | BloqueEnlaces;

export type PaginaContenido = {
    id: string;
    titulo: string;
    slug: string;
    descripcion: string;
    portada: ImagenContenido | null;
    visibleEnMenu: boolean;
    orden: number;
    estado: EstadoPagina;
    /** ISO completo: la tabla muestra sólo la fecha, el editor la fecha y hora. */
    actualizadaEn: string;
    /** Usuaria que hizo la última edición (sólo lo devuelve el detalle). */
    actualizadaPor?: string;
    /** Lo que devuelve el listado sin cargar los bloques. En el detalle es `bloques.length`. */
    cantidadBloques: number;
    bloques: Bloque[];
};

export type RequisitoPublicacion = { ok: boolean; label: string };

export function nuevoId(prefijo: string): string {
    return `${prefijo}-${Math.random().toString(36).slice(2, 9)}`;
}

export function slugify(texto: string): string {
    return texto
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

export function slugValido(slug: string): boolean {
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

export function imagenVacia(prefijo: string = "img"): ImagenContenido {
    return { id: nuevoId(prefijo), imagenId: null, url: "", alt: "", epigrafe: "", ancho: null, alto: null, subiendo: false };
}

// Mientras la subida está en curso se muestra el archivo elegido con un
// objectURL; al terminar, la URL y el `imagenId` los reemplaza el backend. El
// objectURL no se revoca en la sesión (se libera al recargar la pestaña).
export function imagenDesdeArchivo(file: File, anterior?: ImagenContenido | null, prefijo: string = "img"): ImagenContenido {
    return {
        id: anterior?.id ?? nuevoId(prefijo),
        imagenId: anterior?.imagenId ?? null,
        url: URL.createObjectURL(file),
        alt: anterior?.alt ?? "",
        epigrafe: anterior?.epigrafe ?? "",
        ancho: anterior?.ancho ?? null,
        alto: anterior?.alto ?? null,
        subiendo: true
    };
}

export const TIPOS_BLOQUE: Array<{ tipo: TipoBloque; label: string; descripcion: string; icon: string }> = [
    { tipo: "hero", label: "Hero", descripcion: "Apertura con título, bajada e imagen.", icon: "layout-dashboard" },
    { tipo: "texto", label: "Texto", descripcion: "Párrafos con negrita, cursiva y enlaces.", icon: "type" },
    { tipo: "imagen-texto", label: "Imagen y texto", descripcion: "Una imagen al lado de un párrafo.", icon: "columns-2" },
    { tipo: "galeria", label: "Galería", descripcion: "Varias imágenes en grilla, con epígrafe.", icon: "layout-template" },
    { tipo: "cita", label: "Cita", descripcion: "Una frase destacada con su autor.", icon: "quote" },
    { tipo: "datos", label: "Datos", descripcion: "Cifras y etiquetas para resumir.", icon: "chart-column" },
    { tipo: "enlaces", label: "Enlaces", descripcion: "Destinos con una línea de contexto.", icon: "link" }
];

export function etiquetaTipo(tipo: TipoBloque): string {
    return TIPOS_BLOQUE.find((item) => item.tipo === tipo)?.label ?? tipo;
}

export function iconoTipo(tipo: TipoBloque): string {
    return TIPOS_BLOQUE.find((item) => item.tipo === tipo)?.icon ?? "file-text";
}

export function crearBloque(tipo: TipoBloque): Bloque {
    const id = nuevoId("bloque");
    switch (tipo) {
        case "hero":
            return { id, tipo, titulo: "", bajada: "", imagen: null };
        case "texto":
            return { id, tipo, titulo: "", contenido: "" };
        case "imagen-texto":
            return { id, tipo, titulo: "", texto: "", imagen: null, posicion: "derecha" };
        case "galeria":
            return { id, tipo, titulo: "", imagenes: [], columnas: 2 };
        case "cita":
            return { id, tipo, texto: "", autor: "", fuente: "" };
        case "datos":
            return {
                id,
                tipo,
                titulo: "",
                items: [
                    { id: nuevoId("dato"), valor: "", etiqueta: "" },
                    { id: nuevoId("dato"), valor: "", etiqueta: "" }
                ]
            };
        case "enlaces":
            return {
                id,
                tipo,
                titulo: "",
                items: [{ id: nuevoId("enlace"), etiqueta: "", href: "", descripcion: "" }]
            };
    }
}

export function resumenBloque(bloque: Bloque): string {
    const recortar = (texto: string) => (texto.length > 72 ? `${texto.slice(0, 72).trimEnd()}…` : texto);
    switch (bloque.tipo) {
        case "hero":
            return bloque.titulo || "Sin título todavía";
        case "texto":
            return bloque.titulo || recortar(bloque.contenido.replace(/\s+/g, " ")) || "Sin contenido todavía";
        case "imagen-texto":
            return bloque.titulo || recortar(bloque.texto.replace(/\s+/g, " ")) || "Sin contenido todavía";
        case "galeria":
            return bloque.imagenes.length === 0 ? "Sin imágenes todavía" : `${bloque.imagenes.length} ${bloque.imagenes.length === 1 ? "imagen" : "imágenes"}`;
        case "cita":
            return recortar(bloque.texto) || "Sin cita todavía";
        case "datos":
            return `${bloque.items.length} ${bloque.items.length === 1 ? "dato" : "datos"}`;
        case "enlaces":
            return `${bloque.items.length} ${bloque.items.length === 1 ? "enlace" : "enlaces"}`;
    }
}

export function imagenesDePagina(pagina: PaginaContenido): ImagenContenido[] {
    const imagenes: ImagenContenido[] = [];
    // Cuentan las imágenes ya subidas y las que se están subiendo: una fila de
    // galería recién agregada y todavía vacía no debe bloquear la publicación
    // por "falta de texto alternativo", pero una subida en curso sí tiene que
    // esperar antes de guardar/publicar.
    const cuenta = (imagen: ImagenContenido) => imagen.imagenId !== null || imagen.subiendo;
    if (pagina.portada && cuenta(pagina.portada)) imagenes.push(pagina.portada);
    for (const bloque of pagina.bloques) {
        if (bloque.tipo === "hero" || bloque.tipo === "imagen-texto") {
            if (bloque.imagen && cuenta(bloque.imagen)) imagenes.push(bloque.imagen);
        }
        if (bloque.tipo === "galeria") imagenes.push(...bloque.imagenes.filter(cuenta));
    }
    return imagenes;
}

export function haySubidasPendientes(pagina: PaginaContenido): boolean {
    return imagenesDePagina(pagina).some((imagen) => imagen.subiendo);
}

export function requisitosDePublicacion(pagina: PaginaContenido, slugDisponible: boolean): RequisitoPublicacion[] {
    const imagenesSinAlt = imagenesDePagina(pagina).filter((imagen) => imagen.alt.trim() === "").length;
    return [
        { ok: pagina.titulo.trim() !== "", label: "Título de la página" },
        { ok: slugValido(pagina.slug) && slugDisponible, label: "Slug válido y disponible" },
        { ok: pagina.descripcion.trim() !== "", label: "Descripción para buscadores" },
        { ok: pagina.bloques.length > 0, label: "Al menos un bloque de contenido" },
        { ok: imagenesSinAlt === 0, label: "Todas las imágenes con texto alternativo" }
    ];
}

export function borradorNuevo(): PaginaContenido {
    return {
        id: "nueva",
        titulo: "",
        slug: "",
        descripcion: "",
        portada: null,
        visibleEnMenu: true,
        orden: 1,
        estado: "borrador",
        actualizadaEn: new Date().toISOString(),
        cantidadBloques: 0,
        bloques: []
    };
}
