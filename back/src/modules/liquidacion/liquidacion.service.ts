import { LiquidacionRepository } from "./liquidacion.repository";

export type LiquidacionServiceDeps = {
    repository: LiquidacionRepository;
};

type LibroLiquidacion = {
    id_libro: number;
    isbn: string;
    titulo: string;
    cantidad_vendida: number;
    precio_unitario: number;
    importe_total: number;
};

type DetallePersona = {
    id_libro: number;
    titulo: string;
    tipo: "autor" | "ilustrador";
    porcentaje: number;
    importe: number;
};

type PersonaLiquidacion = {
    id_persona: number;
    nombre: string;
    detalle: DetallePersona[];
    total_a_pagar: number;
};

export type Liquidacion = {
    total_facturado: number;
    ejemplares_vendidos: number;
    libros: LibroLiquidacion[];
    personas: PersonaLiquidacion[];
};

// Mismo criterio que `VentaRepository.calcTotal`: dos decimales, importes
// monetarios.
const round2 = (n: number): number => parseFloat(n.toFixed(2));

// `desde`/`hasta` (YYYY-MM-DD) son inclusivos: el rango de fecha/hora que se
// consulta va desde el inicio del día `desde` hasta el final del día
// `hasta`, ambos en UTC (mismo huso con el que se guarda `fecha` en
// `transaccionesTable`, que usa `defaultNow()`).
const inicioDelDia = (fecha: string): Date => new Date(`${fecha}T00:00:00.000Z`);
const finDelDia = (fecha: string): Date => new Date(`${fecha}T23:59:59.999Z`);

// Agrupa las líneas de venta por libro: cantidad_vendida es la suma de cada
// línea, importe_total la suma de (precio histórico × cantidad) de cada
// línea, y precio_unitario el promedio ponderado resultante.
const agruparLibros = (
    lineas: Awaited<ReturnType<LiquidacionRepository["getLineasVenta"]>>
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

// Agrupa la participación de cada persona en los libros vendidos: el
// `importe` de cada línea de `detalle` sale del importe_total ya calculado
// del libro (precio histórico) por el porcentaje vigente de esa persona.
const agruparPersonas = (
    personasPorLibro: Awaited<ReturnType<LiquidacionRepository["getPersonasPorLibro"]>>,
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
            tipo: fila.tipo,
            porcentaje,
            importe
        });
        persona.total_a_pagar = round2(persona.total_a_pagar + importe);

        personas.set(fila.id_persona, persona);
    }

    return Array.from(personas.values());
};

export function createLiquidacionService({ repository }: LiquidacionServiceDeps) {
    const generar = async (userId: number, desde: string, hasta: string): Promise<Liquidacion> => {
        const lineas = await repository.getLineasVenta(userId, inicioDelDia(desde), finDelDia(hasta));

        const librosMap = agruparLibros(lineas);
        const libros = Array.from(librosMap.values());

        const total_facturado = round2(libros.reduce((acc, l) => acc + l.importe_total, 0));
        const ejemplares_vendidos = libros.reduce((acc, l) => acc + l.cantidad_vendida, 0);

        const personasPorLibro = await repository.getPersonasPorLibro(libros.map((l) => l.id_libro), userId);
        const personas = agruparPersonas(personasPorLibro, librosMap);

        return { total_facturado, ejemplares_vendidos, libros, personas };
    };

    return { generar };
}

export type LiquidacionService = ReturnType<typeof createLiquidacionService>;
