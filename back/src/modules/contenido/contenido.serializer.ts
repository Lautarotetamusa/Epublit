import { Storage } from "../../lib/storage/storage";
import { comoObjeto, comoReferenciaImagen } from "./contenido.blocks";
import type { BloqueRow, ImagenRow, PaginaRow } from "./contenido.repository";
import type { ImagenReferenciaInput } from "./contenido.validator";

export type ImagenResueltaAdmin = {
    imagenId: number;
    url: string | null;
    textoAlternativo: string | null;
    epigrafe: string | null;
    ancho: number | null;
    alto: number | null;
};

export type ImagenResueltaPublica = Omit<ImagenResueltaAdmin, "imagenId">;

export type PaginaListado = {
    id: number;
    titulo: string;
    slug: string | null;
    descripcion: string | null;
    estado: string;
    visibleEnMenu: boolean;
    orden: number;
    cantidadBloques: number;
    actualizadaEn: Date;
};

export function toAdminImagen(
    referencia: ImagenReferenciaInput,
    imagenes: Map<number, ImagenRow>,
    storage: Storage
): ImagenResueltaAdmin {
    const imagen = imagenes.get(referencia.imagenId);

    return {
        imagenId: referencia.imagenId,
        url: imagen ? storage.getUrl(imagen.storage_key) : null,
        textoAlternativo: referencia.textoAlternativo ?? null,
        epigrafe: referencia.epigrafe ?? null,
        ancho: imagen?.ancho ?? null,
        alto: imagen?.alto ?? null
    };
}

export function toPublicImagen(
    referencia: ImagenReferenciaInput,
    imagenes: Map<number, ImagenRow>,
    storage: Storage
): ImagenResueltaPublica {
    const imagen = toAdminImagen(referencia, imagenes, storage);

    return {
        url: imagen.url,
        textoAlternativo: imagen.textoAlternativo,
        epigrafe: imagen.epigrafe,
        ancho: imagen.ancho,
        alto: imagen.alto
    };
}

const transformarImagenesDeBloque = (
    contenido: Record<string, unknown>,
    transformar: (referencia: ImagenReferenciaInput) => unknown
): Record<string, unknown> => {
    const resultado: Record<string, unknown> = { ...contenido };

    const imagen = comoReferenciaImagen(resultado.imagen);
    if (imagen) resultado.imagen = transformar(imagen);

    if (Array.isArray(resultado.imagenes)) {
        resultado.imagenes = resultado.imagenes.map((item) => {
            const referencia = comoReferenciaImagen(item);
            return referencia ? transformar(referencia) : item;
        });
    }

    return resultado;
};

export function toAdminBloque(
    bloque: BloqueRow,
    imagenes: Map<number, ImagenRow>,
    storage: Storage
) {
    const contenido = transformarImagenesDeBloque(comoObjeto(bloque.contenido), (referencia) =>
        toAdminImagen(referencia, imagenes, storage)
    );

    return {
        id: bloque.id,
        tipo: bloque.tipo,
        ...contenido
    };
}

export function toPublicBloque(
    bloque: BloqueRow,
    imagenes: Map<number, ImagenRow>,
    storage: Storage
) {
    const contenido = transformarImagenesDeBloque(comoObjeto(bloque.contenido), (referencia) =>
        toPublicImagen(referencia, imagenes, storage)
    );

    return {
        id: bloque.id,
        tipo: bloque.tipo,
        ...contenido
    };
}

const portadaDe = (
    pagina: PaginaRow,
    imagenes: Map<number, ImagenRow>,
    storage: Storage
): ImagenResueltaAdmin | null => {
    if (pagina.portada_imagen_id === null) return null;

    return toAdminImagen(
        {
            imagenId: pagina.portada_imagen_id,
            textoAlternativo: pagina.portada_texto_alternativo,
            epigrafe: pagina.portada_epigrafe
        },
        imagenes,
        storage
    );
};

const portadaPublicaDe = (
    pagina: PaginaRow,
    imagenes: Map<number, ImagenRow>,
    storage: Storage
): ImagenResueltaPublica | null => {
    if (pagina.portada_imagen_id === null) return null;

    return toPublicImagen(
        {
            imagenId: pagina.portada_imagen_id,
            textoAlternativo: pagina.portada_texto_alternativo,
            epigrafe: pagina.portada_epigrafe
        },
        imagenes,
        storage
    );
};

export function toPaginaListado(
    pagina: PaginaRow,
    cantidadBloques: number
): PaginaListado {
    return {
        id: pagina.id,
        titulo: pagina.titulo,
        slug: pagina.slug,
        descripcion: pagina.descripcion,
        estado: pagina.estado,
        visibleEnMenu: pagina.visible_en_menu,
        orden: pagina.orden,
        cantidadBloques,
        actualizadaEn: pagina.actualizada_en
    };
}

export function toPaginaAdmin(
    pagina: PaginaRow,
    actualizadaPor: string,
    bloques: BloqueRow[],
    imagenes: Map<number, ImagenRow>,
    storage: Storage
) {
    return {
        id: pagina.id,
        titulo: pagina.titulo,
        slug: pagina.slug,
        descripcion: pagina.descripcion,
        estado: pagina.estado,
        visibleEnMenu: pagina.visible_en_menu,
        orden: pagina.orden,
        portada: portadaDe(pagina, imagenes, storage),
        bloques: bloques.map((bloque) => toAdminBloque(bloque, imagenes, storage)),
        actualizadaEn: pagina.actualizada_en,
        actualizadaPor
    };
}

export function toPaginaPublica(
    pagina: PaginaRow,
    bloques: BloqueRow[],
    imagenes: Map<number, ImagenRow>,
    storage: Storage
) {
    return {
        slug: pagina.slug,
        titulo: pagina.titulo,
        descripcion: pagina.descripcion,
        portada: portadaPublicaDe(pagina, imagenes, storage),
        actualizadaEn: pagina.actualizada_en,
        bloques: bloques.map((bloque) => toPublicBloque(bloque, imagenes, storage))
    };
}

export function toPaginaPublicaListado(
    pagina: PaginaRow,
    imagenes: Map<number, ImagenRow>,
    storage: Storage
) {
    return {
        slug: pagina.slug,
        titulo: pagina.titulo,
        descripcion: pagina.descripcion,
        portada: portadaPublicaDe(pagina, imagenes, storage),
        actualizadaEn: pagina.actualizada_en
    };
}
