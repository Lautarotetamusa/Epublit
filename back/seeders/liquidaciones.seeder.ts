import { and, asc, eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { movimientosTable } from "../src/db/schema";
import { LiquidacionesService } from "../src/modules/liquidaciones";
import { LibroPersonaService, LibroService, PublicLibro } from "../src/modules/libro";
import { PublicPersona } from "../src/modules/persona";
import { RolService } from "../src/modules/rol";
import { mesAnterior, mesDeFecha, ultimoDiaDelMes } from "../src/modules/metricas/metricas.periodo";
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

const MESES_LIQUIDACION_HISTORICA = 12;
const PORCENTAJE_PAGO_HISTORICA = 0.4;

// Los `MESES_LIQUIDACION_HISTORICA` meses completos anteriores al mes en curso.
const periodoHistorico = (): { desde: string; hasta: string } => {
    const ultimo = mesAnterior(mesDeFecha(new Date()));
    let primero = ultimo;
    for (let i = 1; i < MESES_LIQUIDACION_HISTORICA; i++) primero = mesAnterior(primero);

    return { desde: `${primero}-01`, hasta: `${ultimo}-${String(ultimoDiaDelMes(ultimo)).padStart(2, "0")}` };
};

export type LiquidacionHistoricaDeps = {
    libros: PublicLibro[];
    personas: PublicPersona[];
    libroService: Pick<LibroService, "getPersonas">;
    libroPersonaService: LibroPersonaService;
    rolService: Pick<RolService, "findActivos">;
    liquidacionesService: LiquidacionesService;
};

// La primera persona de la cuenta pasa a ilustrar todos los libros donde
// todavía no lo hace: con el reparto de seedLibrosPersonas nadie supera los
// cuatro libros, y el reporte por autor necesita un caso largo para verse.
const sumarPersonaProlifica = async (user: SeedUser, deps: LiquidacionHistoricaDeps) => {
    const persona = deps.personas.find((candidata) => candidata.user === user.id)!;
    const ilustrador = (await deps.rolService.findActivos(user.id)).find((rol) => rol.nombre === "ilustrador")!;

    for (const libro of deps.libros.filter((candidato) => candidato.user === user.id)) {
        const actuales = await deps.libroService.getPersonas(libro.id_libro, user.id);
        const yaIlustra = actuales.some((p) => p.id_persona === persona.id && p.rol.id === ilustrador.id);
        if (yaIlustra) continue;

        await deps.libroPersonaService.addToLibro(libro.isbn, user.id, [{ id_persona: persona.id, rol: ilustrador.id, porcentaje: 5 }]);
    }
};

// Una liquidación con muchas ventas (las de meses anteriores que carga el
// seeder de métricas), para ver el detalle y el reporte por autor de una
// persona con varios libros y roles. Corre después de `seedMetricas`.
export async function seedLiquidacionHistorica(users: SeedUser[], deps: LiquidacionHistoricaDeps): Promise<void> {
    const { desde, hasta } = periodoHistorico();
    const { liquidacionesService } = deps;

    for (const user of users) {
        await sumarPersonaProlifica(user, deps);
        const liquidacion = await liquidacionesService.generar(user.id, desde, hasta);

        const conMasLibros = [...liquidacion.personas].sort((a, b) => b.detalle.length - a.detalle.length)[0];
        const monto = round2(conMasLibros.saldo * PORCENTAJE_PAGO_HISTORICA);
        if (monto > 0) {
            await liquidacionesService.registrarPago(user.id, liquidacion.id, conMasLibros.id_persona, { monto, fecha: hasta });
        }
    }
}
