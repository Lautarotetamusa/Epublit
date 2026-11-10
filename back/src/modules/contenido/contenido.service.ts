import { randomUUID } from "crypto";
import { Database, Tx } from "../../db/client";
import { detectImageFormat, getImageSize } from "../../lib/image/imageSize";
import { Storage } from "../../lib/storage/storage";
import {
    assertBloquesSeguros,
    comoObjeto,
    comoReferenciaImagen,
    idsDeImagenes,
    referenciaImagenEn,
    referenciasDeBloques,
    type ReferenciaImagenConContexto
} from "./contenido.blocks";
import { ContenidoError, type ContenidoDetalle } from "./contenido.errors";
import {
    ContenidoRepository,
    type BloqueRow,
    type ImagenRow,
    type PaginaConEditor,
    type PaginaRow
} from "./contenido.repository";
import {
    toPaginaAdmin,
    toPaginaListado,
    toPaginaPublica,
    toPaginaPublicaListado
} from "./contenido.serializer";
import {
    slugValidator,
    type BloqueWrite,
    type ImagenReferenciaInput,
    type PaginaBody,
    type PaginaListQuery,
    type UsoImagen
} from "./contenido.validator";

export type ContenidoServiceDeps = {
    db: Database;
    repository: ContenidoRepository;
    storage: Storage;
};

type ArchivoImagen = {
    buffer: Buffer;
    mimetype: string;
    size: number;
};

const MAX_IMAGEN_BYTES = 8 * 1024 * 1024;
const POSICION_TEMPORAL = 1000;

const MINIMOS_POR_USO: Record<UsoImagen, { ancho: number; alto: number }> = {
    portada: { ancho: 1200, alto: 600 },
    hero: { ancho: 1200, alto: 600 },
    bloque: { ancho: 800, alto: 450 },
    galeria: { ancho: 800, alto: 450 }
};

const EXTENSION_POR_MIME: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
};

// Formatos que sí son imágenes pero no están permitidos: se distinguen de un
// archivo ilegible para devolver `formato_no_permitido` en vez de
// `archivo_invalido` (ver plan, tarea 2).
const pareceImagenNoSoportada = (buffer: Buffer): boolean => {
    const cabecera = buffer.toString("ascii", 0, 12);
    const marca = buffer.toString("ascii", 4, 12);
    const comoTexto = buffer.toString("utf8", 0, 256).trimStart().toLowerCase();

    return (
        cabecera.startsWith("GIF87a") ||
        cabecera.startsWith("GIF89a") ||
        cabecera.startsWith("BM") ||
        (buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a) ||
        (buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x00) ||
        ["ftypavif", "ftypheic", "ftypheix", "ftypmif1"].includes(marca) ||
        comoTexto.startsWith("<svg")
    );
};

const detalle = (campo: string, codigo: string, mensaje: string): ContenidoDetalle => ({
    campo,
    codigo,
    mensaje
});

export function createContenidoService({ db, repository, storage }: ContenidoServiceDeps) {
    const cargarImagenes = async (
        userId: number,
        portadaId: number | null,
        bloques: BloqueRow[]
    ): Promise<Map<number, ImagenRow>> => {
        const ids = new Set<number>();
        if (portadaId !== null) ids.add(portadaId);
        bloques.forEach((bloque) => idsDeImagenes(bloque.contenido, ids));

        const imagenes = await repository.findImagenesByIds(userId, [...ids]);
        return new Map(imagenes.map((imagen) => [imagen.id, imagen]));
    };

    const detalleAdmin = async (pagina: PaginaRow, actualizadaPor: string, userId: number) => {
        const bloques = await repository.findBlocksByPage(pagina.id, userId);
        const imagenes = await cargarImagenes(userId, pagina.portada_imagen_id, bloques);

        return toPaginaAdmin(pagina, actualizadaPor, bloques, imagenes, storage);
    };

    const findPagina = async (id: number, userId: number): Promise<PaginaConEditor> => {
        const pagina = await repository.findPageById(id, userId);
        if (!pagina) {
            throw new ContenidoError(404, "no_encontrado", "La página no existe");
        }

        return pagina;
    };

    const assertSlugLibre = async (userId: number, slug: string | null, excluirId?: number) => {
        if (slug === null) return;

        if (await repository.slugEnUso(userId, slug, excluirId)) {
            throw new ContenidoError(409, "slug_duplicado", "Ya hay otra página con este slug");
        }
    };

    const referenciasDeLaPagina = (
        portada: ImagenReferenciaInput | null,
        bloques: BloqueWrite[]
    ): ReferenciaImagenConContexto[] => {
        const referencias: ReferenciaImagenConContexto[] = [];

        if (portada) {
            referencias.push({ campo: "portada", contexto: "portada", referencia: portada });
        }

        referencias.push(...referenciasDeBloques(bloques));
        return referencias;
    };

    const assertImagenesValidas = async (
        userId: number,
        portada: ImagenReferenciaInput | null,
        bloques: BloqueWrite[]
    ): Promise<void> => {
        const referencias = referenciasDeLaPagina(portada, bloques);
        if (referencias.length === 0) return;

        const ids = [...new Set(referencias.map((referencia) => referencia.referencia.imagenId))];
        const imagenes = new Map(
            (await repository.findImagenesByIds(userId, ids)).map((imagen) => [imagen.id, imagen])
        );

        const faltantes = referencias.filter(
            (referencia) => !imagenes.has(referencia.referencia.imagenId)
        );
        if (faltantes.length > 0) {
            throw new ContenidoError(
                400,
                "imagen_inexistente",
                "Hay imágenes que no existen o son de otra cuenta",
                faltantes.map((referencia) =>
                    detalle(referencia.campo, "imagen_inexistente", "La imagen no existe")
                )
            );
        }

        const insuficientes = referencias.filter((referencia) => {
            if (referencia.contexto !== "portada" && referencia.contexto !== "hero") return false;

            const imagen = imagenes.get(referencia.referencia.imagenId);
            return imagen !== undefined && (imagen.ancho < 1200 || imagen.alto < 600);
        });
        if (insuficientes.length > 0) {
            throw new ContenidoError(
                400,
                "imagen_resolucion_insuficiente",
                "La imagen no alcanza la resolución mínima para portada o hero",
                insuficientes.map((referencia) =>
                    detalle(
                        referencia.campo,
                        "imagen_resolucion_insuficiente",
                        "Se necesitan al menos 1200×600"
                    )
                )
            );
        }
    };

    const guardarBloques = async (
        paginaId: number,
        userId: number,
        bloques: BloqueWrite[],
        executor: Database | Tx
    ): Promise<void> => {
        const existentes = await repository.findBlocksByPage(paginaId, userId, executor);
        const existentesPorId = new Map(existentes.map((bloque) => [bloque.id, bloque]));
        const idsConservados = new Set<number>();

        bloques.forEach((bloque) => {
            if (bloque.id === undefined) return;

            if (idsConservados.has(bloque.id) || !existentesPorId.has(bloque.id)) {
                throw new ContenidoError(400, "bloque_inexistente", "El bloque no pertenece a la página", [
                    detalle("bloques", "bloque_inexistente", `El bloque ${bloque.id} no existe en la página`)
                ]);
            }

            idsConservados.add(bloque.id);
        });

        const eliminados = existentes
            .filter((bloque) => !idsConservados.has(bloque.id))
            .map((bloque) => bloque.id);
        await repository.deleteBlocks(eliminados, userId, executor);
        await repository.offsetBlockPositions(paginaId, userId, POSICION_TEMPORAL, executor);

        for (const [posicion, bloque] of bloques.entries()) {
            const { id, tipo, ...contenido } = bloque;
            const datos = {
                tipo,
                posicion,
                contenido: contenido as Record<string, unknown>
            };

            if (id === undefined) {
                await repository.insertBlock(
                    { ...datos, pagina_id: paginaId, user: userId },
                    executor
                );
                continue;
            }

            await repository.updateBlock(id, paginaId, userId, datos, executor);
        }
    };

    const insertarOActualizar = async (
        userId: number,
        body: PaginaBody,
        paginaId?: number
    ): Promise<number> => {
        assertBloquesSeguros(body.bloques);
        await assertSlugLibre(userId, body.slug, paginaId);
        await assertImagenesValidas(userId, body.portada, body.bloques);

        return db.transaction(async (tx) => {
            const datos = {
                titulo: body.titulo,
                slug: body.slug,
                descripcion: body.descripcion,
                visible_en_menu: body.visibleEnMenu,
                orden: body.orden,
                portada_imagen_id: body.portada?.imagenId ?? null,
                portada_texto_alternativo: body.portada?.textoAlternativo ?? null,
                portada_epigrafe: body.portada?.epigrafe ?? null,
                actualizada_en: new Date(),
                actualizada_por: userId
            };

            if (paginaId === undefined) {
                const id = await repository.insertPage({ ...datos, user: userId }, tx);
                await guardarBloques(id, userId, body.bloques, tx);
                return id;
            }

            await repository.updatePage(paginaId, userId, datos, tx);
            await guardarBloques(paginaId, userId, body.bloques, tx);
            return paginaId;
        });
    };

    const getPage = async (id: number, userId: number) => {
        const pagina = await findPagina(id, userId);
        return detalleAdmin(pagina.pagina, pagina.actualizadaPor, userId);
    };

    const listPages = async (userId: number, query: PaginaListQuery) => {
        const buscar = query.buscar?.trim() || undefined;
        const filas = await repository.findActivePages(userId, buscar);
        const cantidades = await repository.countBlocksByPage(userId);

        const conteos = {
            todas: filas.length,
            publicadas: filas.filter((fila) => fila.pagina.estado === "publicada").length,
            borradores: filas.filter((fila) => fila.pagina.estado === "borrador").length
        };

        const filtradas = filas.filter((fila) => {
            if (query.estado === "publicadas") return fila.pagina.estado === "publicada";
            if (query.estado === "borradores") return fila.pagina.estado === "borrador";
            return true;
        });

        return {
            paginas: filtradas.map((fila) =>
                toPaginaListado(fila.pagina, cantidades.get(fila.pagina.id) ?? 0)
            ),
            total: filtradas.length,
            conteos
        };
    };

    const slugDisponible = async (userId: number, slug: string, paginaId?: number) => {
        const resultado = slugValidator.safeParse(slug);
        if (!resultado.success) return { disponible: false, motivo: "invalido" as const };

        const enUso = await repository.slugEnUso(userId, resultado.data, paginaId);
        return enUso
            ? { disponible: false, motivo: "en_uso" as const }
            : { disponible: true, motivo: "libre" as const };
    };

    const createPage = async (userId: number, body: PaginaBody) => {
        const id = await insertarOActualizar(userId, body);
        return getPage(id, userId);
    };

    const updatePage = async (id: number, userId: number, body: PaginaBody) => {
        await findPagina(id, userId);
        await insertarOActualizar(userId, body, id);
        return getPage(id, userId);
    };

    const deletePage = async (id: number, userId: number) => {
        const eliminada = await repository.softDeletePage(id, userId);
        if (!eliminada) {
            throw new ContenidoError(404, "no_encontrado", "La página no existe");
        }

        return { eliminada: true };
    };

    const faltantesDePublicacion = (pagina: PaginaRow, bloques: BloqueRow[]): ContenidoDetalle[] => {
        const faltantes: ContenidoDetalle[] = [];

        if (pagina.titulo.trim() === "") {
            faltantes.push(detalle("titulo", "titulo_faltante", "Falta el título de la página"));
        }

        if (pagina.slug === null) {
            faltantes.push(detalle("slug", "slug_faltante", "Falta el slug de la página"));
        } else if (!slugValidator.safeParse(pagina.slug).success) {
            faltantes.push(detalle("slug", "slug_invalido", "El slug no tiene un formato válido"));
        }

        if (pagina.descripcion === null || pagina.descripcion.trim() === "") {
            faltantes.push(
                detalle("descripcion", "descripcion_faltante", "Falta la descripción de la página")
            );
        }

        if (bloques.length === 0) {
            faltantes.push(detalle("bloques", "sin_bloques", "La página necesita al menos un bloque"));
        }

        if (
            pagina.portada_imagen_id !== null &&
            (pagina.portada_texto_alternativo === null ||
                pagina.portada_texto_alternativo.trim() === "")
        ) {
            faltantes.push(
                detalle(
                    "portada.textoAlternativo",
                    "imagen_sin_texto_alternativo",
                    "La portada necesita texto alternativo"
                )
            );
        }

        bloques.forEach((bloque, indice) => {
            const contenido = comoObjeto(bloque.contenido);
            const imagen = comoReferenciaImagen(contenido.imagen);

            if (
                (bloque.tipo === "hero" || bloque.tipo === "imagen_texto") &&
                imagen !== null &&
                (imagen.textoAlternativo === null || imagen.textoAlternativo.trim() === "")
            ) {
                faltantes.push(
                    detalle(
                        `bloques[${indice}].imagen.textoAlternativo`,
                        "imagen_sin_texto_alternativo",
                        "La imagen necesita texto alternativo"
                    )
                );
            }

            if (bloque.tipo !== "galeria" || !Array.isArray(contenido.imagenes)) return;

            contenido.imagenes.forEach((item, imagenIndice) => {
                const referencia = comoReferenciaImagen(item);
                if (
                    referencia !== null &&
                    (referencia.textoAlternativo === null || referencia.textoAlternativo.trim() === "")
                ) {
                    faltantes.push(
                        detalle(
                            `bloques[${indice}].imagenes[${imagenIndice}].textoAlternativo`,
                            "imagen_sin_texto_alternativo",
                            "La imagen necesita texto alternativo"
                        )
                    );
                }
            });
        });

        return faltantes;
    };

    const publicar = async (id: number, userId: number) => {
        const pagina = await findPagina(id, userId);
        if (pagina.pagina.estado === "publicada") {
            return detalleAdmin(pagina.pagina, pagina.actualizadaPor, userId);
        }

        if (pagina.pagina.slug !== null) {
            await assertSlugLibre(userId, pagina.pagina.slug, pagina.pagina.id);
        }

        const bloques = await repository.findBlocksByPage(id, userId);
        const faltantes = faltantesDePublicacion(pagina.pagina, bloques);
        if (faltantes.length > 0) {
            throw new ContenidoError(
                422,
                "publicacion_incompleta",
                "Faltan requisitos para publicar la página",
                faltantes
            );
        }

        await repository.setEstado(id, userId, "publicada");
        return getPage(id, userId);
    };

    const despublicar = async (id: number, userId: number) => {
        const pagina = await findPagina(id, userId);
        if (pagina.pagina.estado === "borrador") {
            return detalleAdmin(pagina.pagina, pagina.actualizadaPor, userId);
        }

        await repository.setEstado(id, userId, "borrador");
        return getPage(id, userId);
    };

    const uploadImage = async (userId: number, uso: UsoImagen, archivo: ArchivoImagen) => {
        if (archivo.size > MAX_IMAGEN_BYTES) {
            throw new ContenidoError(
                413,
                "archivo_demasiado_grande",
                "La imagen no puede pesar más de 8 MB"
            );
        }

        const formato = detectImageFormat(archivo.buffer);
        if (formato === null) {
            if (pareceImagenNoSoportada(archivo.buffer)) {
                throw new ContenidoError(
                    400,
                    "formato_no_permitido",
                    "Sólo se aceptan imágenes JPG, PNG o WebP"
                );
            }

            throw new ContenidoError(400, "archivo_invalido", "El archivo no es una imagen válida");
        }

        const dimensiones = getImageSize(archivo.buffer, formato);
        if (dimensiones === null || dimensiones.width <= 0 || dimensiones.height <= 0) {
            throw new ContenidoError(400, "archivo_invalido", "El archivo no es una imagen válida");
        }

        const minimo = MINIMOS_POR_USO[uso];
        if (dimensiones.width < minimo.ancho || dimensiones.height < minimo.alto) {
            throw new ContenidoError(
                422,
                "resolucion_insuficiente",
                `La imagen necesita al menos ${minimo.ancho}×${minimo.alto} para ${uso}`,
                [
                    detalle(
                        "archivo",
                        "resolucion_insuficiente",
                        `Se necesitan al menos ${minimo.ancho}×${minimo.alto}`
                    )
                ]
            );
        }

        const extension = EXTENSION_POR_MIME[formato];
        const key = `contenido/${userId}/${randomUUID()}.${extension}`;
        await storage.write(key, archivo.buffer);

        const imagen = await repository.insertImagen({
            user: userId,
            storage_key: key,
            mime: formato,
            bytes: archivo.size,
            ancho: dimensiones.width,
            alto: dimensiones.height
        });

        return {
            id: imagen.id,
            url: storage.getUrl(imagen.storage_key),
            ancho: imagen.ancho,
            alto: imagen.alto,
            mime: imagen.mime,
            bytes: imagen.bytes
        };
    };

    const deleteImage = async (id: number, userId: number) => {
        const imagen = await repository.findImagenById(id, userId);
        if (!imagen) {
            throw new ContenidoError(404, "no_encontrado", "La imagen no existe");
        }

        const referencias = await repository.findActiveImageReferences(userId);
        const enUso =
            referencias.portadaImagenIds.includes(id) ||
            referencias.bloques.some((contenido) => referenciaImagenEn(contenido, id));
        if (enUso) {
            throw new ContenidoError(409, "imagen_en_uso", "La imagen está siendo usada por una página");
        }

        if (await storage.exists(imagen.storage_key)) {
            await storage.remove(imagen.storage_key);
        }

        await repository.clearPortadaFromDeletedPages(userId, id);
        await repository.deleteImagen(id, userId);
        return { eliminada: true };
    };

    const listPublicPages = async (userId: number) => {
        const filas = await repository.findActivePages(userId);
        const publicadas = filas.filter(
            (fila) => fila.pagina.estado === "publicada" && fila.pagina.slug !== null
        );
        const ids = publicadas
            .map((fila) => fila.pagina.portada_imagen_id)
            .filter((id): id is number => id !== null);
        const imagenes = new Map(
            (await repository.findImagenesByIds(userId, ids)).map((imagen) => [imagen.id, imagen])
        );

        return {
            paginas: publicadas.map((fila) =>
                toPaginaPublicaListado(fila.pagina, imagenes, storage)
            )
        };
    };

    const getPublicPage = async (slug: string, userId: number) => {
        const fila = await repository.findPublishedPageBySlug(slug, userId);
        if (!fila) {
            throw new ContenidoError(404, "no_encontrado", "La página no existe");
        }

        const bloques = await repository.findBlocksByPage(fila.pagina.id, userId);
        const imagenes = await cargarImagenes(userId, fila.pagina.portada_imagen_id, bloques);

        return { pagina: toPaginaPublica(fila.pagina, bloques, imagenes, storage) };
    };

    const getPublicMenu = async (userId: number) => {
        const filas = await repository.findActivePages(userId);
        const paginas = filas.flatMap((fila) => {
            if (fila.pagina.estado !== "publicada" || !fila.pagina.visible_en_menu) return [];
            if (fila.pagina.slug === null) return [];

            return [{ titulo: fila.pagina.titulo, slug: fila.pagina.slug }];
        });

        return { paginas };
    };

    return {
        listPages,
        slugDisponible,
        getPage,
        createPage,
        updatePage,
        deletePage,
        publicar,
        despublicar,
        uploadImage,
        deleteImage,
        listPublicPages,
        getPublicPage,
        getPublicMenu
    };
}

export type ContenidoService = ReturnType<typeof createContenidoService>;
