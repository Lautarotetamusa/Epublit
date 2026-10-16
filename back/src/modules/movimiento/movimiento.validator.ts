import { createPkSchema } from "bradb";
import { z } from "zod";
import { movimientosTable, movimientoTipoEnum, extremoTipoEnum } from "./movimiento.schema";

export type MovimientoTipo = (typeof movimientoTipoEnum.enumValues)[number];
export type ExtremoTipo = (typeof extremoTipoEnum.enumValues)[number];

// Los extremos `cliente` quedan reservados para una historia futura: al no ser
// un literal válido, el parseo los rechaza con 400 (igual que `deposito` sin
// `id`; `.strict()` rechaza `id` en un extremo `exterior`).
const extremoDeposito = z.object({
    tipo: z.literal("deposito"),
    id: z.number().int().positive()
}).strict();

const extremoExterior = z.object({
    tipo: z.literal("exterior")
}).strict();

const extremo = z.union([extremoDeposito, extremoExterior]);

const libro = z.object({
    isbn: z.string().min(1),
    cantidad: z.number().int().positive()
}).strict();

const esExterior = (e: z.infer<typeof extremo>) => e.tipo === "exterior";

const mismoExtremo = (a: z.infer<typeof extremo>, b: z.infer<typeof extremo>) =>
    a.tipo === "deposito" && b.tipo === "deposito" && a.id === b.id;

const insert = z
    .object({
        origen: extremo,
        destino: extremo,
        libros: z.array(libro).min(1)
    })
    .strict()
    .superRefine((body, ctx) => {
        if (esExterior(body.origen) && esExterior(body.destino)) {
            ctx.addIssue({ code: "custom", message: "Un movimiento de exterior a exterior no tiene efecto", path: ["destino"] });
        }

        if (mismoExtremo(body.origen, body.destino)) {
            ctx.addIssue({ code: "custom", message: "El origen y el destino no pueden ser el mismo depósito", path: ["destino"] });
        }

        const isbns = body.libros.map((l) => l.isbn);
        if (new Set(isbns).size !== isbns.length) {
            ctx.addIssue({ code: "custom", message: "No se puede repetir un isbn en la lista de libros", path: ["libros"] });
        }
    });

// Filtros de `GET /movimiento/`: todos opcionales, combinables por AND entre
// sí y con la paginación. `tipo` fuera del enum, `deposito`/`cliente` no
// numéricos, fechas inválidas y `pagina`/`porPagina` no enteros o menores a 1
// devuelven 400.
const listMovimientosFilter = z
    .object({
        tipo: z.enum(movimientoTipoEnum.enumValues).optional(),
        deposito: z.coerce.number().int().positive().optional(),
        cliente: z.coerce.number().int().positive().optional(),
        desde: z.coerce.date().optional(),
        hasta: z.coerce.date().optional(),
        pagina: z.coerce.number().int().min(1).default(1),
        porPagina: z.coerce.number().int().min(1).default(10)
    })
    .refine((data) => !data.desde || !data.hasta || data.desde <= data.hasta, {
        message: "'desde' no puede ser posterior a 'hasta'",
        path: ["desde"]
    });

const pk = createPkSchema(movimientosTable).pick({ id: true });

export type MovimientoInsert = z.infer<typeof insert>;
export type ListMovimientosFilter = z.infer<typeof listMovimientosFilter>;
export type ExtremoInput = z.infer<typeof extremo>;

export const movimientoValidator = {
    insert,
    listMovimientosFilter,
    pk
};
