import {z} from 'zod';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { createTransaccion } from './transaccion.validator';
import { ventasTable } from './venta.schema';

export const medioPago = {
    efectivo: "efectivo",
    debito: "debito",
    credito: "credito",
    mercadopago: "mercadopago",
    transferencia: "transferencia"
} as const;
export type MedioPago = keyof typeof medioPago;

export const tiposComprobantes = {
    1: {
        cod: 'A',
        descripcion: "Factura A"
    },
    6: {
        cod: 'B',
        descripcion: "Factura B"
    },
    11: {
        cod: 'C',
        descripcion: "Factura C"
    },
    51: {
        cod: 'M',
        descripction: "Factura M"
    }
} as const;

const ventaSchema = z.object({
    id_transaccion: z.number(),
    descuento: z.number().max(100).default(0),
    medio_pago: z.enum(Object.keys(medioPago) as [MedioPago]),
    total: z.number(),
    tipo_cbte: z.number().refine((val) => val in tiposComprobantes, {
        message: "El tipo de comprobante no es valido"
    })
});
export type VentaSchema = z.infer<typeof ventaSchema>;

export const createVenta = ventaSchema.pick({
    descuento: true,
    medio_pago: true,
    tipo_cbte: true,
}).and(createTransaccion);

export const createVentaConsignado = createVenta.and(z.object({
    fecha_venta: z.coerce.date()
}));

export type CreateVenta = z.infer<typeof createVenta>;
export type CreateVentaConsignado = z.infer<typeof createVentaConsignado>;

const saveVenta = ventaSchema;
export type SaveVenta = z.infer<typeof saveVenta>;

// Los únicos dos tipos de transacción que representan una "venta" (ver
// `OperacionConfig.esVenta` en operacion.config.ts): usado tanto por el
// filtro `tipo` de abajo como por `venta.repository.ts#getAll`, que sin
// filtro explícito trae ambos (GET /venta ya mostraba ambos tipos en la
// columna "Tipo" del listado del front, ver VentasPage.tsx).
export const tipoVentaValues = ["venta", "ventaConsignacion"] as const;
export type TipoVenta = (typeof tipoVentaValues)[number];

// Query params de `GET /venta` (ver specs/002-filtro-ventas/plan.md,
// "Diseño de API"): todos opcionales y combinables entre sí (AND).
export const listVentasFilter = z
    .object({
        cliente: z.coerce.number().int().positive().optional(),
        tipo: z.enum(tipoVentaValues).optional(),
        medioPago: z.enum(Object.keys(medioPago) as [MedioPago]).optional(),
        desde: z.coerce.date().optional(),
        hasta: z.coerce.date().optional(),
        page: z.coerce.number().int().positive().default(1),
        pageSize: z.coerce.number().int().positive().default(10)
    })
    .refine((data) => !data.desde || !data.hasta || data.desde <= data.hasta, {
        message: "'desde' no puede ser posterior a 'hasta'",
        path: ["desde"]
    });
export type ListVentasFilter = z.infer<typeof listVentasFilter>;

// Validators nuevos (Postgres/Drizzle), usados por venta.service.ts/
// operacion.config.ts.
const select = createSelectSchema(ventasTable);
const insert = createInsertSchema(ventasTable).omit({ id_transaccion: true });

export type VentaRow = z.infer<typeof select>;
export type VentaInsert = z.infer<typeof insert>;

export const ventaValidator = {
    select,
    insert
};
