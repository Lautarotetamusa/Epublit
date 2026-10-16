import { z } from "zod";

// Período compartido por el reporte y la generación: `desde`/`hasta`
// inclusivos, en formato YYYY-MM-DD. `z.iso.date()` ya rechaza formatos y
// fechas inválidas (ej. "2026-13-01", "2026-02-30").
const rango = z
    .object({
        desde: z.iso.date(),
        hasta: z.iso.date()
    })
    .refine((data) => data.desde <= data.hasta, {
        message: "'desde' no puede ser posterior a 'hasta'",
        path: ["desde"]
    });

// Pago parcial de una persona dentro de una liquidación: monto + fecha + nota
// opcional, sin medio de pago (ver specs/012-liquidaciones-pagos, tarea 8).
const pago = z
    .object({
        monto: z.number().positive("El monto debe ser mayor a 0"),
        fecha: z.iso.date(),
        nota: z.string().optional()
    })
    .strict();

const pk = z.object({ id: z.coerce.number().int().positive() });

const pagoParams = z.object({
    id: z.coerce.number().int().positive(),
    idPersona: z.coerce.number().int().positive()
});

const anularParams = z.object({
    id: z.coerce.number().int().positive(),
    idPago: z.coerce.number().int().positive()
});

export type LiquidacionRango = z.infer<typeof rango>;
export type LiquidacionPagoBody = z.infer<typeof pago>;

export const liquidacionesValidator = {
    rango,
    pago,
    pk,
    pagoParams,
    anularParams
};
