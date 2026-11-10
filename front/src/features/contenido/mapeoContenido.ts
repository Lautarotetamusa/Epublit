import type {
    BloqueBackend,
    BloqueInput,
    ImagenBackend,
    ImagenReferenciaInput,
    PaginaBackend,
    PaginaInput,
    PaginaListadoBackend
} from "../../api/contenido";
import type { Bloque, ImagenContenido, PaginaContenido } from "./tipos";
import { nuevoId } from "./tipos";

// Traducción entre el contrato del backend y el modelo que usa la UI. El
// backend guarda `imagen_texto` y los enlaces como `nombre`/`destino`; la UI
// conserva los nombres aprobados en el diseño (`imagen-texto`,
// `etiqueta`/`href`). Todo el mapeo vive acá para que los componentes no
// conozcan dos vocabularios a la vez.

const texto = (valor: unknown): string => (typeof valor === "string" ? valor : "");

const aImagenContenido = (imagen: ImagenBackend | null): ImagenContenido | null => {
    if (!imagen) return null;

    return {
        // La identidad de la colocación es local: la misma imagen puede usarse
        // en portada, hero y una galería con textos alternativos distintos.
        id: nuevoId("img"),
        imagenId: imagen.imagenId,
        url: imagen.url ?? "",
        alt: imagen.textoAlternativo ?? "",
        epigrafe: imagen.epigrafe ?? "",
        ancho: imagen.ancho,
        alto: imagen.alto,
        subiendo: false
    };
};

const aBloque = (bloque: BloqueBackend): Bloque => {
    const id = String(bloque.id);

    switch (bloque.tipo) {
        case "hero":
            return {
                id,
                tipo: "hero",
                titulo: texto(bloque.titulo),
                bajada: texto(bloque.bajada),
                imagen: aImagenContenido(bloque.imagen)
            };
        case "texto":
            return {
                id,
                tipo: "texto",
                titulo: texto(bloque.titulo),
                contenido: texto(bloque.contenido)
            };
        case "imagen_texto":
            return {
                id,
                tipo: "imagen-texto",
                titulo: texto(bloque.titulo),
                texto: texto(bloque.texto),
                imagen: aImagenContenido(bloque.imagen),
                posicion: bloque.posicion === "izquierda" ? "izquierda" : "derecha"
            };
        case "galeria":
            return {
                id,
                tipo: "galeria",
                titulo: texto(bloque.titulo),
                imagenes: bloque.imagenes.flatMap((imagen) => {
                    const mapeada = aImagenContenido(imagen);
                    return mapeada ? [mapeada] : [];
                }),
                columnas: bloque.columnas === 2 ? 2 : 3
            };
        case "cita":
            return {
                id,
                tipo: "cita",
                texto: texto(bloque.texto),
                autor: texto(bloque.autor),
                fuente: texto(bloque.fuente)
            };
        case "datos":
            return {
                id,
                tipo: "datos",
                titulo: texto(bloque.titulo),
                items: bloque.items.map((item) => ({
                    id: nuevoId("dato"),
                    valor: texto(item.valor),
                    etiqueta: texto(item.etiqueta)
                }))
            };
        case "enlaces":
            return {
                id,
                tipo: "enlaces",
                titulo: texto(bloque.titulo),
                items: bloque.enlaces.map((enlace) => ({
                    id: nuevoId("enlace"),
                    etiqueta: texto(enlace.nombre),
                    href: texto(enlace.destino),
                    descripcion: texto(enlace.descripcion)
                }))
            };
    }
};

export function mapearPagina(pagina: PaginaBackend): PaginaContenido {
    const bloques = pagina.bloques.map(aBloque);

    return {
        id: String(pagina.id),
        titulo: texto(pagina.titulo),
        slug: pagina.slug ?? "",
        descripcion: pagina.descripcion ?? "",
        portada: aImagenContenido(pagina.portada),
        visibleEnMenu: pagina.visibleEnMenu,
        orden: pagina.orden,
        estado: pagina.estado,
        actualizadaEn: pagina.actualizadaEn,
        actualizadaPor: pagina.actualizadaPor,
        cantidadBloques: bloques.length,
        bloques
    };
}

export function mapearPaginaListado(pagina: PaginaListadoBackend): PaginaContenido {
    return {
        id: String(pagina.id),
        titulo: texto(pagina.titulo),
        slug: pagina.slug ?? "",
        descripcion: pagina.descripcion ?? "",
        portada: null,
        visibleEnMenu: pagina.visibleEnMenu,
        orden: pagina.orden,
        estado: pagina.estado,
        actualizadaEn: pagina.actualizadaEn,
        cantidadBloques: pagina.cantidadBloques,
        bloques: []
    };
}

// ---- Escritura -----------------------------------------------------------

const aImagenInput = (imagen: ImagenContenido | null): ImagenReferenciaInput | null => {
    if (!imagen || imagen.imagenId === null) return null;

    return {
        imagenId: imagen.imagenId,
        textoAlternativo: imagen.alt.trim() === "" ? "" : imagen.alt,
        epigrafe: imagen.epigrafe.trim() === "" ? null : imagen.epigrafe
    };
};

const idNumerico = (id: string): number | undefined => {
    const numero = Number(id);
    return Number.isInteger(numero) && numero > 0 ? numero : undefined;
};

const aBloqueInput = (bloque: Bloque): BloqueInput => {
    const id = idNumerico(bloque.id);
    const base = id === undefined ? {} : { id };

    switch (bloque.tipo) {
        case "hero":
            return {
                ...base,
                tipo: "hero",
                titulo: bloque.titulo,
                bajada: bloque.bajada,
                imagen: aImagenInput(bloque.imagen)
            };
        case "texto":
            return { ...base, tipo: "texto", titulo: bloque.titulo, contenido: bloque.contenido };
        case "imagen-texto":
            return {
                ...base,
                tipo: "imagen_texto",
                titulo: bloque.titulo,
                texto: bloque.texto,
                imagen: aImagenInput(bloque.imagen),
                posicion: bloque.posicion
            };
        case "galeria":
            return {
                ...base,
                tipo: "galeria",
                titulo: bloque.titulo,
                imagenes: bloque.imagenes.flatMap((imagen) => {
                    const referencia = aImagenInput(imagen);
                    return referencia ? [referencia] : [];
                }),
                columnas: bloque.columnas
            };
        case "cita":
            return {
                ...base,
                tipo: "cita",
                texto: bloque.texto,
                autor: bloque.autor,
                fuente: bloque.fuente.trim() === "" ? null : bloque.fuente
            };
        case "datos":
            return {
                ...base,
                tipo: "datos",
                titulo: bloque.titulo,
                items: bloque.items.map((item) => ({ valor: item.valor, etiqueta: item.etiqueta }))
            };
        case "enlaces":
            return {
                ...base,
                tipo: "enlaces",
                titulo: bloque.titulo,
                enlaces: bloque.items.map((enlace) => ({
                    nombre: enlace.etiqueta,
                    destino: enlace.href,
                    descripcion: enlace.descripcion.trim() === "" ? null : enlace.descripcion
                }))
            };
    }
};

export function aPaginaInput(pagina: PaginaContenido): PaginaInput {
    return {
        titulo: pagina.titulo,
        slug: pagina.slug.trim() === "" ? null : pagina.slug.trim(),
        descripcion: pagina.descripcion.trim() === "" ? null : pagina.descripcion,
        visibleEnMenu: pagina.visibleEnMenu,
        orden: Math.max(0, Math.trunc(pagina.orden)),
        portada: aImagenInput(pagina.portada),
        bloques: pagina.bloques.map(aBloqueInput)
    };
}
