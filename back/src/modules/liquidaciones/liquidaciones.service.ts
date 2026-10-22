import { BadRequest, NotFound } from "bradb";
import { Database } from "../../db/client";
import { Conflict } from "../../lib/http/errors";
import { aFechaISO } from "../../lib/fecha";
import { LiquidacionesRepository } from "./liquidaciones.repository";
import { LiquidacionPagoBody } from "./liquidaciones.validator";

export type LiquidacionesServiceDeps = {
    db: Database;
    repository: LiquidacionesRepository;
};

export type EstadoLiquidacion = "pendiente" | "parcial" | "pagada";

export type LibroLiquidacion = {
    id_libro: number;
    isbn: string;
    titulo: string;
    cantidad_vendida: number;
    precio_unitario: number;
    importe_total: number;
};

export type DetalleLiquidacion = {
    id_libro: number;
    titulo: string;
    rol: { id: number; nombre: string };
    porcentaje: number;
    importe: number;
};

export type PersonaLiquidacion = {
    id_persona: number;
    nombre: string;
    detalle: DetalleLiquidacion[];
    total_a_pagar: number;
};

export type Excluida = {
    liquidacion_id: number;
    codigo: string;
    ventas: number;
};

export type ReporteLiquidacion = {
    total_facturado: number;
    ejemplares_vendidos: number;
    libros: LibroLiquidacion[];
    personas: PersonaLiquidacion[];
    excluidas: Excluida[];
};

export type LiquidacionListado = {
    id: number;
    codigo: string;
    desde: string;
    hasta: string;
    fecha_generacion: Date;
    personas: number;
    total: number;
    pagado: number;
    saldo: number;
    estado: EstadoLiquidacion;
};

export type PersonaFicha = {
    id_persona: number;
    nombre: string;
    roles: { id: number; nombre: string }[];
    total: number;
    pagado: number;
    saldo: number;
    estado: EstadoLiquidacion;
    detalle: DetalleLiquidacion[];
    pagos: { id: number; monto: number; fecha: string; nota: string | null }[];
};

export type FichaLiquidacion = Omit<LiquidacionListado, "personas"> & { personas: PersonaFicha[] };

// Mismo criterio que `VentaRepository.calcTotal`: dos decimales, importes
// monetarios.
const round2 = (n: number): number => parseFloat(n.toFixed(2));

// `desde`/`hasta` (YYYY-MM-DD) son inclusivos: el rango va desde el inicio del
// día `desde` hasta el final del día `hasta`, ambos en UTC.
const inicioDelDia = (fecha: string): Date => new Date(`${fecha}T00:00:00.000Z`);
const finDelDia = (fecha: string): Date => new Date(`${fecha}T23:59:59.999Z`);

const estadoDe = (pagado: number, total: number): EstadoLiquidacion => {
    const pagadoRedondeado = round2(pagado);
    if (pagadoRedondeado <= 0) return "pendiente";
    if (pagadoRedondeado >= round2(total)) return "pagada";
    return "parcial";
};

// Agrupa las líneas de venta por libro: cantidad_vendida es la suma de cada
// línea, importe_total la suma de (precio histórico × cantidad) y
// precio_unitario el promedio ponderado resultante.
const agruparLibros = (
    lineas: Awaited<ReturnType<LiquidacionesRepository["getLineasVenta"]>>
): Map<number, LibroLiquidacion> => {
    const libros = new Map<number, LibroLiquidacion>();

    for (const linea of lineas) {
        const acumulado = libros.get(linea.id_libro) ?? {
            id_libro: linea.id_libro,
            isbn: linea.isbn,
            titulo: linea.titulo,
            cantidad_vendida: 0,
            precio_unitario: 0,
            importe_total: 0
        };

        acumulado.cantidad_vendida += linea.cantidad;
        acumulado.importe_total = round2(acumulado.importe_total + linea.cantidad * linea.precio);

        libros.set(linea.id_libro, acumulado);
    }

    for (const libro of libros.values()) {
        libro.precio_unitario = libro.cantidad_vendida > 0 ? round2(libro.importe_total / libro.cantidad_vendida) : 0;
    }

    return libros;
};

// Agrupa la participación de cada persona en los libros vendidos: el importe
// de cada línea sale del importe_total del libro (precio histórico) por el
// porcentaje vigente de esa persona.
const agruparPersonas = (
    personasPorLibro: Awaited<ReturnType<LiquidacionesRepository["getPersonasPorLibro"]>>,
    libros: Map<number, LibroLiquidacion>
): PersonaLiquidacion[] => {
    const personas = new Map<number, PersonaLiquidacion>();

    for (const fila of personasPorLibro) {
        const libro = libros.get(fila.id_libro);
        if (!libro) continue;

        const persona = personas.get(fila.id_persona) ?? {
            id_persona: fila.id_persona,
            nombre: fila.nombre,
            detalle: [],
            total_a_pagar: 0
        };

        const porcentaje = fila.porcentaje ?? 0;
        const importe = round2((libro.importe_total * porcentaje) / 100);

        persona.detalle.push({
            id_libro: libro.id_libro,
            titulo: libro.titulo,
            rol: { id: fila.rol_id, nombre: fila.rol_nombre },
            porcentaje,
            importe
        });
        persona.total_a_pagar = round2(persona.total_a_pagar + importe);

        personas.set(fila.id_persona, persona);
    }

    return Array.from(personas.values());
};

export function createLiquidacionesService({ db, repository }: LiquidacionesServiceDeps) {
    // Cálculo base compartido por el reporte y por la generación: ventas del
    // período todavía no cubiertas, agrupadas por libro y por persona, más lo
    // que quedó excluido por liquidaciones anteriores.
    const calcular = async (userId: number, desde: string, hasta: string) => {
        const lineas = await repository.getLineasVenta(userId, inicioDelDia(desde), finDelDia(hasta));

        const librosMap = agruparLibros(lineas);
        const libros = Array.from(librosMap.values());

        const personasPorLibro = await repository.getPersonasPorLibro(libros.map((libro) => libro.id_libro), userId);
        const personas = agruparPersonas(personasPorLibro, librosMap);

        const excluidas = await repository.getExcluidas(userId, inicioDelDia(desde), finDelDia(hasta));
        const movimientoIds = Array.from(new Set(lineas.map((linea) => linea.movimiento_id)));

        return { libros, personas, excluidas, movimientoIds };
    };

    const reporte = async (userId: number, desde: string, hasta: string): Promise<ReporteLiquidacion> => {
        const { libros, personas, excluidas } = await calcular(userId, desde, hasta);

        return {
            total_facturado: round2(libros.reduce((acc, libro) => acc + libro.importe_total, 0)),
            ejemplares_vendidos: libros.reduce((acc, libro) => acc + libro.cantidad_vendida, 0),
            libros,
            personas,
            excluidas
        };
    };

    // Correlativo por año: `LQ-<año>-<número>` con el número en 4 dígitos.
    const siguienteCodigo = async (userId: number): Promise<string> => {
        const anio = new Date().getUTCFullYear();
        const correlativo = (await repository.countDelAnio(userId, anio)) + 1;

        return `LQ-${anio}-${String(correlativo).padStart(4, "0")}`;
    };

    const generar = async (userId: number, desde: string, hasta: string): Promise<FichaLiquidacion> => {
        const { personas, movimientoIds } = await calcular(userId, desde, hasta);

        // Sin líneas no hay liquidación: un período sin ventas pendientes (sin
        // ventas, o todas ya cubiertas) no crea nada (ver
        // specs/012-liquidaciones-pagos, tarea 4).
        if (personas.length === 0) {
            throw new Conflict("El período no tiene ventas pendientes de liquidar");
        }

        const codigo = await siguienteCodigo(userId);

        const liquidacionId = await db.transaction(async (tx) => {
            const liquidacion = await repository.insertLiquidacion({ codigo, desde, hasta, user: userId }, tx);

            for (const persona of personas) {
                const fila = await repository.insertPersonas(
                    [
                        {
                            liquidacion_id: liquidacion.id,
                            id_persona: persona.id_persona,
                            nombre: persona.nombre,
                            total: persona.total_a_pagar,
                            user: userId
                        }
                    ],
                    tx
                );

                await repository.insertLineas(
                    persona.detalle.map((detalle) => ({
                        liquidacion_persona_id: fila[0].id,
                        id_libro: detalle.id_libro,
                        titulo: detalle.titulo,
                        id_rol: detalle.rol.id,
                        rol_nombre: detalle.rol.nombre,
                        porcentaje: detalle.porcentaje,
                        importe: detalle.importe,
                        user: userId
                    })),
                    tx
                );
            }

            await repository.insertVentas(
                movimientoIds.map((movimientoId) => ({ movimiento_id: movimientoId, liquidacion_id: liquidacion.id, user: userId })),
                tx
            );

            return liquidacion.id;
        });

        return ficha(userId, liquidacionId);
    };

    const listar = async (userId: number): Promise<LiquidacionListado[]> => {
        const [liquidaciones, personas, pagos] = await Promise.all([
            repository.getLiquidaciones(userId),
            repository.getPersonasDeUsuario(userId),
            repository.getPagosDeUsuario(userId)
        ]);

        const personasPorLiquidacion = new Map<number, { cantidad: number; total: number }>();
        for (const persona of personas) {
            const acumulado = personasPorLiquidacion.get(persona.liquidacion_id) ?? { cantidad: 0, total: 0 };
            acumulado.cantidad += 1;
            acumulado.total = round2(acumulado.total + persona.total);
            personasPorLiquidacion.set(persona.liquidacion_id, acumulado);
        }

        const pagadoPorLiquidacion = new Map<number, number>();
        for (const pago of pagos) {
            pagadoPorLiquidacion.set(pago.liquidacion_id, round2((pagadoPorLiquidacion.get(pago.liquidacion_id) ?? 0) + pago.monto));
        }

        return liquidaciones.map((liquidacion) => {
            const resumen = personasPorLiquidacion.get(liquidacion.id) ?? { cantidad: 0, total: 0 };
            const pagado = pagadoPorLiquidacion.get(liquidacion.id) ?? 0;

            return {
                id: liquidacion.id,
                codigo: liquidacion.codigo,
                desde: aFechaISO(liquidacion.desde),
                hasta: aFechaISO(liquidacion.hasta),
                fecha_generacion: liquidacion.fecha_generacion,
                personas: resumen.cantidad,
                total: resumen.total,
                pagado,
                saldo: round2(resumen.total - pagado),
                estado: estadoDe(pagado, resumen.total)
            };
        });
    };

    const ficha = async (userId: number, id: number): Promise<FichaLiquidacion> => {
        const liquidacion = await repository.getLiquidacionById(id, userId);

        const [personas, pagos] = await Promise.all([
            repository.getPersonasDeLiquidacion(id, userId),
            repository.getPagosDeLiquidacion(id, userId)
        ]);

        const lineas = await repository.getLineasDePersonas(personas.map((persona) => persona.id), userId);

        const lineasPorPersona = new Map<number, DetalleLiquidacion[]>();
        for (const linea of lineas) {
            const detalle = lineasPorPersona.get(linea.liquidacion_persona_id) ?? [];
            detalle.push({
                id_libro: linea.id_libro,
                titulo: linea.titulo,
                rol: { id: linea.id_rol, nombre: linea.rol_nombre },
                porcentaje: linea.porcentaje,
                importe: linea.importe
            });
            lineasPorPersona.set(linea.liquidacion_persona_id, detalle);
        }

        const pagosPorPersona = new Map<number, typeof pagos>();
        for (const pago of pagos) {
            const lista = pagosPorPersona.get(pago.id_persona) ?? [];
            lista.push(pago);
            pagosPorPersona.set(pago.id_persona, lista);
        }

        const personasFicha: PersonaFicha[] = personas.map((persona) => {
            const detalle = lineasPorPersona.get(persona.id) ?? [];
            const pagosPersona = pagosPorPersona.get(persona.id_persona) ?? [];
            const pagado = round2(pagosPersona.reduce((acc, pago) => acc + pago.monto, 0));

            const roles = Array.from(new Map(detalle.map((linea) => [linea.rol.id, linea.rol])).values());

            return {
                id_persona: persona.id_persona,
                nombre: persona.nombre,
                roles,
                total: persona.total,
                pagado,
                saldo: round2(persona.total - pagado),
                estado: estadoDe(pagado, persona.total),
                detalle,
                pagos: pagosPersona.map((pago) => ({
                    id: pago.id,
                    monto: pago.monto,
                    fecha: aFechaISO(pago.fecha),
                    nota: pago.nota
                }))
            };
        });

        const total = round2(personasFicha.reduce((acc, persona) => acc + persona.total, 0));
        const pagado = round2(personasFicha.reduce((acc, persona) => acc + persona.pagado, 0));

        return {
            id: liquidacion.id,
            codigo: liquidacion.codigo,
            desde: aFechaISO(liquidacion.desde),
            hasta: aFechaISO(liquidacion.hasta),
            fecha_generacion: liquidacion.fecha_generacion,
            total,
            pagado,
            saldo: round2(total - pagado),
            estado: estadoDe(pagado, total),
            personas: personasFicha
        };
    };

    const registrarPago = async (userId: number, id: number, idPersona: number, data: LiquidacionPagoBody): Promise<FichaLiquidacion> => {
        // `getLiquidacionById` da 404 si no existe o es de otra cuenta.
        await repository.getLiquidacionById(id, userId);

        const persona = await repository.findPersonaDeLiquidacion(id, idPersona, userId);
        if (!persona) throw new NotFound(`La persona ${idPersona} no pertenece a la liquidación ${id}`);

        const pagado = round2(
            (await repository.getPagosDeLiquidacion(id, userId))
                .filter((pago) => pago.id_persona === idPersona)
                .reduce((acc, pago) => acc + pago.monto, 0)
        );
        const saldo = round2(persona.total - pagado);

        if (data.monto > saldo) {
            throw new BadRequest(`El monto no puede superar el saldo de ${persona.nombre} (${saldo})`);
        }

        await repository.insertPago({
            liquidacion_id: id,
            id_persona: idPersona,
            monto: data.monto,
            fecha: data.fecha,
            nota: data.nota ?? null,
            user: userId
        });

        return ficha(userId, id);
    };

    const anularPago = async (userId: number, id: number, idPago: number): Promise<FichaLiquidacion> => {
        await repository.getLiquidacionById(id, userId);

        const pago = await repository.getPagoVigente(idPago, id, userId);
        if (!pago) throw new NotFound(`No se encontró el pago con id ${idPago}`);

        await repository.anularPago(idPago, userId);

        return ficha(userId, id);
    };

    return {
        reporte,
        generar,
        listar,
        ficha,
        registrarPago,
        anularPago
    };
}

export type LiquidacionesService = ReturnType<typeof createLiquidacionesService>;
