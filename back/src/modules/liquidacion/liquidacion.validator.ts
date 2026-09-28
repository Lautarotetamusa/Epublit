import { z } from "zod";

// `desde`/`hasta` llegan como query params (string). `z.iso.date()` ya
// rechaza formatos y fechas inválidas (ej. "2026-13-01", "2026-02-30"), así
// que no hace falta un regex propio.
const query = z
    .object({
        desde: z.iso.date(),
        hasta: z.iso.date()
    })
    .refine((data) => data.desde <= data.hasta, {
        message: "'desde' no puede ser posterior a 'hasta'",
        path: ["desde"]
    });

export type LiquidacionQuery = z.infer<typeof query>;

export const liquidacionValidator = {
    query
};
