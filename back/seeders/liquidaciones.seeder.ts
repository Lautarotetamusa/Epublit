import { and, asc, eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { movimientosTable } from "../src/db/schema";
import { LiquidacionesService } from "../src/modules/liquidaciones";
import { SeedUser } from "./users.seeder";

const VENTAS_LIQUIDADAS = 3;
const PORCENTAJE_PAGO_PARCIAL = 0.23;

const round2 = (n: number): number => parseFloat(n.toFixed(2));

// Tres días distintos del mes en curso, siempre distintos de hoy (la venta que
// queda pendiente para el flujo "generar el mes"). Si el corrimiento cruza el
// inicio del mes, se reubica dentro del mismo mes.
const diasLiquidados = (): number[] => {
    const hoy = new Date().getUTCDate();
    return [hoy - 1, hoy - 2, hoy - 3].map((dia) => (dia >= 1 ? dia : dia + 10));
};

const fechaDelMes = (dia: number): string => {
    const hoy = new Date();
    return new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), dia)).toISOString().slice(0, 10);
};

// Deja tres liquidaciones (pagada, parcial y pendiente) con sus personas y
// pagos, generadas por el mismo servicio que el endpoint real: cada una cubre
// una venta del mes en curso, así la previsualización del mes excluye lo ya
// liquidado y todavía queda una venta pendiente para generar la siguiente.
export async function seedLiquidaciones(users: SeedUser[], liquidacionesService: LiquidacionesService): Promise<void> {
    const fechas = diasLiquidados().map(fechaDelMes);

    for (const user of users) {
        const ventas = await db
            .select({ id: movimientosTable.id })
            .from(movimientosTable)
            .where(and(eq(movimientosTable.user, user.id), eq(movimientosTable.tipo, "venta")))
            .orderBy(asc(movimientosTable.id));

        for (let i = 0; i < VENTAS_LIQUIDADAS && i < ventas.length; i++) {
            await db
                .update(movimientosTable)
                .set({ fecha: new Date(`${fechas[i]}T12:00:00.000Z`) })
                .where(eq(movimientosTable.id, ventas[i].id));
        }

        // Pagada: se salda el total de cada persona.
        const pagada = await liquidacionesService.generar(user.id, fechas[0], fechas[0]);
        for (const persona of pagada.personas) {
            if (persona.saldo > 0) {
                await liquidacionesService.registrarPago(user.id, pagada.id, persona.id_persona, {
                    monto: persona.saldo,
                    fecha: fechas[0]
                });
            }
        }

        // Parcial: se paga una parte del saldo de la primera persona.
        const parcial = await liquidacionesService.generar(user.id, fechas[1], fechas[1]);
        const primera = parcial.personas[0];
        const montoParcial = round2(primera.saldo * PORCENTAJE_PAGO_PARCIAL);
        if (montoParcial > 0) {
            await liquidacionesService.registrarPago(user.id, parcial.id, primera.id_persona, {
                monto: montoParcial,
                fecha: fechas[1]
            });
        }

        // Pendiente: sin pagos.
        await liquidacionesService.generar(user.id, fechas[2], fechas[2]);
    }
}
