import { z } from "zod";

// Reglas de forma del contrato de contenido (ver specs/020-cms-landing). Las
// reglas semánticas (HTML, destinos, imágenes) viven en `contenido.blocks.ts`
// y `contenido.service.ts`; acá sólo se define qué campos acepta cada tipo.

export const BLOQUES_MAXIMOS = 60;
export const GALERIA_IMAGENES_MAXIMAS = 24;
export const DATOS_ITEMS_MAXIMOS = 4;
export const ENLACES_MAXIMOS = 20;

const textoOpcional = (maximo: number) =>
    z.string()
        .max(maximo)
        .nullable()
        .optional()
        .transform((valor) => valor ?? null);

export const slugValidator = z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "El slug sólo admite minúsculas, números y guiones simples");

const normalizarTextoAlternativo = (valor: string | null | undefined): string | null => {
    if (valor === null || valor === undefined) return null;
    return valor.trim() === "" ? "" : valor;
};

// La lectura agrega `url`/`ancho`/`alto`; el cliente puede reenviarlos, pero
// no son parte de la escritura y se descartan (el object no es `.strict()`).
export const imagenReferenciaValidator = z.object({
    imagenId: z.number().int().positive(),
    textoAlternativo: z.string().max(300)
        .nullable()
        .optional()
        .transform(normalizarTextoAlternativo),
    epigrafe: textoOpcional(300)
});

const idBloqueValidator = z.number().int().positive().optional();

const bloqueHeroValidator = z
    .object({
        id: idBloqueValidator,
        tipo: z.literal("hero"),
        titulo: z.string().max(200).default(""),
        bajada: z.string().max(500).default(""),
        imagen: imagenReferenciaValidator.nullable().default(null)
    })
    .strict();

const bloqueTextoValidator = z
    .object({
        id: idBloqueValidator,
        tipo: z.literal("texto"),
        titulo: z.string().max(200).default(""),
        contenido: z.string().max(20_000).default("")
    })
    .strict();

const bloqueImagenTextoValidator = z
    .object({
        id: idBloqueValidator,
        tipo: z.literal("imagen_texto"),
        titulo: z.string().max(200).default(""),
        texto: z.string().max(20_000).default(""),
        imagen: imagenReferenciaValidator.nullable().default(null),
        posicion: z.enum(["izquierda", "derecha"]).default("derecha")
    })
    .strict();

const bloqueGaleriaValidator = z
    .object({
        id: idBloqueValidator,
        tipo: z.literal("galeria"),
        titulo: z.string().max(200).default(""),
        imagenes: z.array(imagenReferenciaValidator).max(GALERIA_IMAGENES_MAXIMAS).default([]),
        columnas: z.union([z.literal(2), z.literal(3)]).default(3)
    })
    .strict();

const bloqueCitaValidator = z
    .object({
        id: idBloqueValidator,
        tipo: z.literal("cita"),
        texto: z.string().max(2_000).default(""),
        autor: z.string().max(160).default(""),
        fuente: textoOpcional(160)
    })
    .strict();

const bloqueDatosValidator = z
    .object({
        id: idBloqueValidator,
        tipo: z.literal("datos"),
        titulo: z.string().max(200).default(""),
        items: z
            .array(
                z
                    .object({
                        valor: z.string().max(60).default(""),
                        etiqueta: z.string().max(120).default("")
                    })
                    .strict()
            )
            .max(DATOS_ITEMS_MAXIMOS)
            .default([])
    })
    .strict();

const bloqueEnlacesValidator = z
    .object({
        id: idBloqueValidator,
        tipo: z.literal("enlaces"),
        titulo: z.string().max(200).default(""),
        enlaces: z
            .array(
                z
                    .object({
                        nombre: z.string().max(160).default(""),
                        destino: z.string().max(500),
                        descripcion: textoOpcional(300)
                    })
                    .strict()
            )
            .max(ENLACES_MAXIMOS)
            .default([])
    })
    .strict();

export const bloqueWriteValidator = z.discriminatedUnion("tipo", [
    bloqueHeroValidator,
    bloqueTextoValidator,
    bloqueImagenTextoValidator,
    bloqueGaleriaValidator,
    bloqueCitaValidator,
    bloqueDatosValidator,
    bloqueEnlacesValidator
]);

export const paginaBodyValidator = z.object({
    titulo: z.string().max(200).default(""),
    slug: slugValidator.nullable().default(null),
    descripcion: z.string().max(320).nullable().default(null),
    visibleEnMenu: z.boolean().default(false),
    orden: z.number().int().min(0).default(0),
    portada: imagenReferenciaValidator.nullable().default(null),
    bloques: z.array(bloqueWriteValidator).max(BLOQUES_MAXIMOS).default([])
});

export const paginaListQueryValidator = z.object({
    estado: z.enum(["todas", "publicadas", "borradores"]).default("todas"),
    buscar: z.string().optional()
});

export const slugDisponibleQueryValidator = z.object({
    slug: z.string(),
    paginaId: z.coerce.number().int().positive().optional()
});

export const idParamValidator = z.object({
    id: z.coerce.number().int().positive()
});

export const usoImagenValidator = z.enum(["portada", "hero", "bloque", "galeria"]);

export type UsoImagen = z.infer<typeof usoImagenValidator>;
export type ImagenReferenciaInput = z.infer<typeof imagenReferenciaValidator>;
export type BloqueWrite = z.infer<typeof bloqueWriteValidator>;
export type PaginaBody = z.infer<typeof paginaBodyValidator>;
export type PaginaListQuery = z.infer<typeof paginaListQueryValidator>;
