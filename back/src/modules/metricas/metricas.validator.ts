import { z } from "zod";

// `alcance` separa ventas en firme de ventas sobre consignación; no afecta a
// los ejemplares nuevos (son producción, no venta).
const alcance = z.enum(["todas", "firme", "consignacion"]).default("todas");

// Un período siempre es un mes calendario: `YYYY-MM`, mes 01..12. El resto de
// formatos (o un mes 13) da 400 antes de tocar la base.
const mes = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "El mes debe tener el formato YYYY-MM");

const consulta = z.object({ mes, alcance });
const consultaOpcional = z.object({ alcance });

export type AlcanceMetricas = z.infer<typeof alcance>;
export type MesMetricas = z.infer<typeof mes>;

export const metricasValidator = {
    alcance,
    mes,
    consulta,
    consultaOpcional
};
