import { FECHA_APERTURA_SIN_MOVIMIENTOS } from "./config";
import { DatosMigracion, LibroOrigen, LineaOrigen, TransaccionOrigen, VentaOrigen } from "./tipos";

export type TransaccionConLineas = TransaccionOrigen & { lineas: LineaOrigen[] };

export type AperturaPrincipal = {
    id_libro: number;
    user: number;
    flujo: number;
    apertura: number;
    fecha: string;
};

export type AperturaCliente = {
    id_libro: number;
    id_cliente: number;
    user: number;
    flujo: number;
    apertura: number;
    fecha: string;
};

export type ResumenAnalisis = {
    transacciones_totales: number;
    transacciones_migrables: number;
    transacciones_salteadas: number;
    lineas_migrables: number;
    ventas_totales: number;
    ventas_migrables: number;
    ventas_salteadas: number;
    ventas_sin_fila: number;
    ejemplares_vendidos: number;
    aperturas_principal_ingresos: number;
    aperturas_principal_ingreso_unidades: number;
    aperturas_principal_bajas: number;
    aperturas_principal_baja_unidades: number;
    aperturas_cliente_ingresos: number;
    aperturas_cliente_ingreso_unidades: number;
    aperturas_cliente_bajas: number;
    aperturas_cliente_baja_unidades: number;
    movimientos_apertura_esperados: number;
};

export type AnalisisDatos = {
    lineasPorTransaccion: Map<number, LineaOrigen[]>;
    ventasPorTransaccion: Map<number, VentaOrigen>;
    transaccionesMigrables: TransaccionConLineas[];
    transaccionesSalteadas: TransaccionOrigen[];
    ventasMigrables: VentaOrigen[];
    ventasSalteadas: VentaOrigen[];
    ventasSinFila: TransaccionConLineas[];
    aperturasPrincipal: AperturaPrincipal[];
    aperturasCliente: AperturaCliente[];
    resumen: ResumenAnalisis;
};

const claveClienteLibro = (idLibro: number, idCliente: number): string => `${idCliente}:${idLibro}`;

const esVenta = (tipo: TransaccionOrigen["type"]): boolean => tipo === "venta" || tipo === "ventaConsignacion";

function sumar(mapa: Map<string | number, number>, clave: string | number, delta: number): void {
    mapa.set(clave, (mapa.get(clave) ?? 0) + delta);
}

function registrarFecha(mapa: Map<string | number, string>, clave: string | number, fecha: string): void {
    if (!fecha) return;
    const actual = mapa.get(clave);
    if (actual === undefined || fecha < actual) {
        mapa.set(clave, fecha);
    }
}

function fechaApertura(fecha: string | undefined): string {
    if (!fecha) return FECHA_APERTURA_SIN_MOVIMIENTOS;
    const date = new Date(`${fecha.replace(" ", "T")}Z`);
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 19).replace("T", " ");
}

function indexarLineas(datos: DatosMigracion): Map<number, LineaOrigen[]> {
    const lineasPorTransaccion = new Map<number, LineaOrigen[]>();
    for (const linea of datos.libros_transacciones) {
        const lineas = lineasPorTransaccion.get(linea.id_transaccion) ?? [];
        lineas.push(linea);
        lineasPorTransaccion.set(linea.id_transaccion, lineas);
    }
    return lineasPorTransaccion;
}

function separarTransacciones(
    datos: DatosMigracion,
    lineasPorTransaccion: Map<number, LineaOrigen[]>
): { migrables: TransaccionConLineas[]; salteadas: TransaccionOrigen[] } {
    const migrables: TransaccionConLineas[] = [];
    const salteadas: TransaccionOrigen[] = [];

    for (const transaccion of datos.transacciones) {
        const lineas = lineasPorTransaccion.get(transaccion.id) ?? [];
        if (lineas.length === 0) {
            salteadas.push(transaccion);
        } else {
            migrables.push({ ...transaccion, lineas });
        }
    }

    return { migrables, salteadas };
}

function separarVentas(
    datos: DatosMigracion,
    idsMigrables: Set<number>
): { migrables: VentaOrigen[]; salteadas: VentaOrigen[] } {
    return {
        migrables: datos.ventas.filter((venta) => idsMigrables.has(venta.id_transaccion)),
        salteadas: datos.ventas.filter((venta) => !idsMigrables.has(venta.id_transaccion))
    };
}

type Flujos = {
    principal: Map<number, number>;
    cliente: Map<string, number>;
    primerMovimientoLibro: Map<number, string>;
    primerMovimientoClienteLibro: Map<string, string>;
};

function calcularFlujos(transacciones: readonly TransaccionConLineas[]): Flujos {
    const flujos: Flujos = {
        principal: new Map(),
        cliente: new Map(),
        primerMovimientoLibro: new Map(),
        primerMovimientoClienteLibro: new Map()
    };

    for (const transaccion of transacciones) {
        for (const linea of transaccion.lineas) {
            const clave = claveClienteLibro(linea.id_libro, transaccion.id_cliente);
            registrarFecha(flujos.primerMovimientoLibro, linea.id_libro, transaccion.fecha);
            registrarFecha(flujos.primerMovimientoClienteLibro, clave, transaccion.fecha);

            switch (transaccion.type) {
                case "venta":
                    sumar(flujos.principal, linea.id_libro, -linea.cantidad);
                    break;
                case "consignacion":
                    sumar(flujos.principal, linea.id_libro, -linea.cantidad);
                    sumar(flujos.cliente, clave, linea.cantidad);
                    break;
                case "devolucion":
                    sumar(flujos.principal, linea.id_libro, linea.cantidad);
                    sumar(flujos.cliente, clave, -linea.cantidad);
                    break;
                case "ventaConsignacion":
                    sumar(flujos.cliente, clave, -linea.cantidad);
                    break;
            }
        }
    }

    return flujos;
}

function calcularAperturasPrincipal(
    libros: readonly LibroOrigen[],
    flujos: Flujos
): AperturaPrincipal[] {
    return libros
        .map((libro) => ({
            id_libro: libro.id_libro,
            user: libro.user,
            flujo: flujos.principal.get(libro.id_libro) ?? 0,
            apertura: libro.stock - (flujos.principal.get(libro.id_libro) ?? 0),
            fecha: fechaApertura(flujos.primerMovimientoLibro.get(libro.id_libro))
        }))
        .filter((apertura) => apertura.apertura !== 0);
}

function calcularAperturasCliente(
    datos: DatosMigracion,
    flujos: Flujos
): AperturaCliente[] {
    const librosPorId = new Map(datos.libros.map((libro) => [libro.id_libro, libro]));
    const stockCliente = new Map(
        datos.libro_cliente.map((fila) => [claveClienteLibro(fila.id_libro, fila.id_cliente), fila.stock])
    );
    const claves = new Set([...stockCliente.keys(), ...flujos.cliente.keys()]);
    const aperturas: AperturaCliente[] = [];

    for (const clave of claves) {
        const [idCliente, idLibro] = clave.split(":").map(Number);
        const libro = librosPorId.get(idLibro);
        if (!libro) throw new Error(`El libro ${idLibro} de libro_cliente no está en el catálogo migrado`);

        const flujo = flujos.cliente.get(clave) ?? 0;
        const apertura = (stockCliente.get(clave) ?? 0) - flujo;
        if (apertura === 0) continue;

        aperturas.push({
            id_libro: idLibro,
            id_cliente: idCliente,
            user: libro.user,
            flujo,
            apertura,
            fecha: fechaApertura(flujos.primerMovimientoClienteLibro.get(clave))
        });
    }

    return aperturas;
}

function sumarUnidades(aperturas: readonly { apertura: number }[], signo: 1 | -1): number {
    return aperturas
        .filter((apertura) => Math.sign(apertura.apertura) === signo)
        .reduce((total, apertura) => total + Math.abs(apertura.apertura), 0);
}

function contar(aperturas: readonly { apertura: number }[], signo: 1 | -1): number {
    return aperturas.filter((apertura) => Math.sign(apertura.apertura) === signo).length;
}

function calcularResumen(
    datos: DatosMigracion,
    transaccionesMigrables: readonly TransaccionConLineas[],
    transaccionesSalteadas: readonly TransaccionOrigen[],
    ventasMigrables: readonly VentaOrigen[],
    ventasSalteadas: readonly VentaOrigen[],
    ventasSinFila: readonly TransaccionConLineas[],
    aperturasPrincipal: readonly AperturaPrincipal[],
    aperturasCliente: readonly AperturaCliente[]
): ResumenAnalisis {
    const lineasMigrables = transaccionesMigrables.reduce((total, t) => total + t.lineas.length, 0);
    const ejemplaresVendidos = transaccionesMigrables
        .filter((transaccion) => esVenta(transaccion.type))
        .reduce(
            (total, transaccion) =>
                total + transaccion.lineas.reduce((subtotal, linea) => subtotal + linea.cantidad, 0),
            0
        );

    return {
        transacciones_totales: datos.transacciones.length,
        transacciones_migrables: transaccionesMigrables.length,
        transacciones_salteadas: transaccionesSalteadas.length,
        lineas_migrables: lineasMigrables,
        ventas_totales: datos.ventas.length,
        ventas_migrables: ventasMigrables.length,
        ventas_salteadas: ventasSalteadas.length,
        ventas_sin_fila: ventasSinFila.length,
        ejemplares_vendidos: ejemplaresVendidos,
        aperturas_principal_ingresos: contar(aperturasPrincipal, 1),
        aperturas_principal_ingreso_unidades: sumarUnidades(aperturasPrincipal, 1),
        aperturas_principal_bajas: contar(aperturasPrincipal, -1),
        aperturas_principal_baja_unidades: sumarUnidades(aperturasPrincipal, -1),
        aperturas_cliente_ingresos: contar(aperturasCliente, 1),
        aperturas_cliente_ingreso_unidades: sumarUnidades(aperturasCliente, 1),
        aperturas_cliente_bajas: contar(aperturasCliente, -1),
        aperturas_cliente_baja_unidades: sumarUnidades(aperturasCliente, -1),
        movimientos_apertura_esperados: aperturasPrincipal.length + aperturasCliente.length
    };
}

export function analizarDatos(datos: DatosMigracion): AnalisisDatos {
    const lineasPorTransaccion = indexarLineas(datos);
    const { migrables, salteadas } = separarTransacciones(datos, lineasPorTransaccion);
    const idsMigrables = new Set(migrables.map((transaccion) => transaccion.id));
    const { migrables: ventasMigrables, salteadas: ventasSalteadas } = separarVentas(datos, idsMigrables);
    const ventasPorTransaccion = new Map(datos.ventas.map((venta) => [venta.id_transaccion, venta]));
    const ventasSinFila = migrables.filter(
        (transaccion) => esVenta(transaccion.type) && !ventasPorTransaccion.has(transaccion.id)
    );
    const flujos = calcularFlujos(migrables);
    const aperturasPrincipal = calcularAperturasPrincipal(datos.libros, flujos);
    const aperturasCliente = calcularAperturasCliente(datos, flujos);

    return {
        lineasPorTransaccion,
        ventasPorTransaccion,
        transaccionesMigrables: migrables,
        transaccionesSalteadas: salteadas,
        ventasMigrables,
        ventasSalteadas,
        ventasSinFila,
        aperturasPrincipal,
        aperturasCliente,
        resumen: calcularResumen(
            datos,
            migrables,
            salteadas,
            ventasMigrables,
            ventasSalteadas,
            ventasSinFila,
            aperturasPrincipal,
            aperturasCliente
        )
    };
}

export function mapearFilePath(tipo: TransaccionOrigen["type"], filePath: string | null): string | null {
    if (!filePath) return null;
    // El storage nuevo sirve keys con carpeta (`files/facturas/...`), igual que
    // la migración 0005: se preserva el nombre del archivo y se agrega el prefijo.
    return tipo === "consignacion" ? `remitos/${filePath}` : `facturas/${filePath}`;
}

export function esTransaccionDeVenta(tipo: TransaccionOrigen["type"]): boolean {
    return esVenta(tipo);
}
