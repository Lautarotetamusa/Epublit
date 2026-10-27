import { z } from "zod";
import { orderStatusEnum } from "./order.schema";

const ORDER_STATUSES = [...orderStatusEnum.enumValues, "todos"] as const;

const isValidDay = (value: string): boolean => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return false;

    const [, year, month, day] = match;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

    return (
        date.getUTCFullYear() === Number(year) &&
        date.getUTCMonth() === Number(month) - 1 &&
        date.getUTCDate() === Number(day)
    );
};

const day = z
    .string()
    .trim()
    .refine(isValidDay, "La fecha debe tener formato YYYY-MM-DD y ser válida");

export const listOrdersQuery = z
    .object({
        estado: z.enum(ORDER_STATUSES).optional(),
        desde: day.optional(),
        hasta: day.optional(),
        entrega: z.enum(["envio", "retiro"]).optional(),
        buscar: z.string().trim().max(200).optional(),
        pagina: z.coerce.number().int().min(1).default(1),
        porPagina: z.coerce.number().int().min(1).max(100).default(20)
    })
    .strict()
    .refine((query) => !query.desde || !query.hasta || query.desde <= query.hasta, {
        message: "'desde' no puede ser posterior a 'hasta'",
        path: ["desde"]
    });

export const orderCodeSchema = z.string().trim().min(1).max(30);

export const rejectOrderSchema = z
    .object({
        motivo: z.string().trim().min(1, "El motivo es obligatorio").max(500),
        detalle: z.string().trim().max(2000).optional()
    })
    .strict();

const address = {
    calle: z.string().trim().max(160).optional(),
    numero: z.string().trim().max(20).optional(),
    piso: z.string().trim().max(20).optional(),
    depto: z.string().trim().max(20).optional(),
    localidad: z.string().trim().max(120).optional(),
    provincia: z.string().trim().max(120).optional(),
    codigoPostal: z.string().trim().max(12).optional()
};

export const labelOrderSchema = z
    .object({
        direccion: z.object(address).strict().optional()
    })
    .strict();

export type ListOrdersQuery = z.infer<typeof listOrdersQuery>;
export type RejectOrderInput = z.infer<typeof rejectOrderSchema>;
export type LabelOrderInput = z.infer<typeof labelOrderSchema>;
export type AddressCorrection = NonNullable<LabelOrderInput["direccion"]>;

// Argentina no aplica horario de verano: el día local siempre es UTC-3. Los
// filtros son inclusivos, por eso `hasta` llega al último milisegundo.
export const argentinaDayStart = (value: string): Date =>
    new Date(`${value}T00:00:00.000-03:00`);

export const argentinaDayEnd = (value: string): Date =>
    new Date(`${value}T23:59:59.999-03:00`);
