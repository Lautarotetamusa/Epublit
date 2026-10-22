import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, resolve } from "path";
import { analizarDatos, AnalisisDatos } from "./analisis";
import { cargarDatos, ResultadoCarga } from "./cargar";
import { crearConfig } from "./config";
import { extraerDatos } from "./extraer";
import { DatosMigracion } from "./tipos";
import { verificarDatos } from "./verificar";

type Opciones = {
    dryRun: boolean;
    reset: boolean;
    forzar: boolean;
    desdeJson: boolean;
    json: string;
};

const AYUDA = `
Uso: npm run migracion:prod -- [opciones]

  --dry-run        Extrae MySQL, guarda el JSON y reporta sin escribir en Postgres.
  --reset          Trunca las tablas de dominio del destino antes de cargar.
  --json <ruta>    Ruta del JSON intermedio (default: datos.json junto al script).
  --desde-json     Carga el JSON indicado sin volver a leer MySQL.
  --forzar         Permite ajustar aperturas negativas del depósito principal.
  --help           Muestra esta ayuda.

Variables de entorno:
  MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE
  DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME (o MIGRACION_DB_*)
  MIGRACION_ALLOW_TARGET=1 para aceptar un destino que no termine en _migracion.
`.trim();

function parsearOpciones(argv: readonly string[]): Opciones {
    const opciones: Opciones = {
        dryRun: false,
        reset: false,
        forzar: false,
        desdeJson: false,
        json: resolve(__dirname, "datos.json")
    };

    for (let index = 0; index < argv.length; index += 1) {
        const argumento = argv[index];
        if (argumento === "--dry-run") opciones.dryRun = true;
        else if (argumento === "--reset") opciones.reset = true;
        else if (argumento === "--forzar") opciones.forzar = true;
        else if (argumento === "--desde-json") opciones.desdeJson = true;
        else if (argumento === "--help") {
            console.log(AYUDA);
            process.exit(0);
        } else if (argumento === "--json") {
            const ruta = argv[index + 1];
            if (!ruta) throw new Error("--json necesita una ruta");
            opciones.json = resolve(ruta);
            index += 1;
        } else if (argumento.startsWith("--json=")) {
            opciones.json = resolve(argumento.slice("--json=".length));
        } else {
            throw new Error(`Opción desconocida: ${argumento}\n\n${AYUDA}`);
        }
    }

    return opciones;
}

async function guardarJson(ruta: string, datos: DatosMigracion): Promise<void> {
    await mkdir(dirname(ruta), { recursive: true });
    await writeFile(ruta, JSON.stringify(datos, null, 2), "utf8");
    console.log(`JSON intermedio: ${ruta}`);
}

async function leerJson(ruta: string): Promise<DatosMigracion> {
    const contenido = await readFile(ruta, "utf8");
    const datos = JSON.parse(contenido) as Partial<DatosMigracion>;
    const obligatorias: Array<keyof DatosMigracion> = [
        "meta",
        "users",
        "clientes",
        "personas",
        "libros",
        "precio_libros",
        "precio_libro_cliente",
        "libro_cliente",
        "libros_personas",
        "transacciones",
        "libros_transacciones",
        "ventas"
    ];
    const faltantes = obligatorias.filter((clave) => datos[clave] === undefined);
    if (faltantes.length > 0) {
        throw new Error(`JSON inválido: faltan ${faltantes.join(", ")}`);
    }
    console.log(`JSON de entrada: ${ruta}`);
    return datos as DatosMigracion;
}

function imprimirConteos(datos: DatosMigracion): void {
    const conteos: Array<[string, number]> = [
        ["users", datos.users.length],
        ["clientes", datos.clientes.length],
        ["personas", datos.personas.length],
        ["libros", datos.libros.length],
        ["precio_libros", datos.precio_libros.length],
        ["precio_libro_cliente", datos.precio_libro_cliente.length],
        ["libro_cliente", datos.libro_cliente.length],
        ["libros_personas", datos.libros_personas.length],
        ["transacciones", datos.transacciones.length],
        ["libros_transacciones", datos.libros_transacciones.length],
        ["ventas", datos.ventas.length]
    ];

    console.log("\nConteos extraídos del origen:");
    for (const [nombre, cantidad] of conteos) {
        console.log(`  ${nombre.padEnd(22)} ${cantidad.toLocaleString("es-AR").padStart(8)}`);
    }
}

function imprimirAperturas(analisis: AnalisisDatos): void {
    const resumen = analisis.resumen;
    console.log("\nAperturas calculadas:");
    console.log(
        `  principal: ${resumen.aperturas_principal_ingresos} ingreso(s) ` +
            `por ${resumen.aperturas_principal_ingreso_unidades} ejemplares, ` +
            `${resumen.aperturas_principal_bajas} baja(s) por ${resumen.aperturas_principal_baja_unidades}`
    );
    console.log(
        `  clientes:  ${resumen.aperturas_cliente_ingresos} ingreso(s) ` +
            `por ${resumen.aperturas_cliente_ingreso_unidades} ejemplares, ` +
            `${resumen.aperturas_cliente_bajas} baja(s) por ${resumen.aperturas_cliente_baja_unidades}`
    );

    const negativasCliente = analisis.aperturasCliente.filter((apertura) => apertura.apertura < 0);
    if (negativasCliente.length > 0) {
        console.log("\n  Aperturas negativas de depósito de cliente (se ajustan con tipo baja):");
        for (const apertura of negativasCliente.slice(0, 20)) {
            console.log(
                `    cliente ${apertura.id_cliente} / libro ${apertura.id_libro}: ${apertura.apertura}`
            );
        }
        if (negativasCliente.length > 20) {
            console.log(`    ... y ${negativasCliente.length - 20} más`);
        }
    }

    const negativasPrincipal = analisis.aperturasPrincipal.filter((apertura) => apertura.apertura < 0);
    if (negativasPrincipal.length > 0) {
        console.log("\n  ATENCIÓN: aperturas negativas del depósito principal:");
        for (const apertura of negativasPrincipal.slice(0, 20)) {
            console.log(
                `    usuario ${apertura.user} / libro ${apertura.id_libro}: ${apertura.apertura}`
            );
        }
    }
}

function imprimirAnomalias(analisis: AnalisisDatos): void {
    const resumen = analisis.resumen;
    console.log("\nTransacciones y ventas:");
    console.log(
        `  transacciones: ${resumen.transacciones_totales} total, ` +
            `${resumen.transacciones_migrables} migrables, ${resumen.transacciones_salteadas} salteadas`
    );
    console.log(
        `  ventas:        ${resumen.ventas_totales} total, ${resumen.ventas_migrables} migrables, ` +
            `${resumen.ventas_salteadas} salteadas, ${resumen.ventas_sin_fila} sin fila`
    );
    console.log(`  líneas migrables: ${resumen.lineas_migrables}`);
    console.log(`  ejemplares vendidos: ${resumen.ejemplares_vendidos}`);

    if (analisis.transaccionesSalteadas.length > 0) {
        console.log("\n  Transacciones sin líneas (se saltean, no generan movimiento):");
        for (const transaccion of analisis.transaccionesSalteadas.slice(0, 20)) {
            console.log(
                `    id ${transaccion.id} (${transaccion.type}, usuario ${transaccion.user}, ${transaccion.fecha})`
            );
        }
        if (analisis.transaccionesSalteadas.length > 20) {
            console.log(`    ... y ${analisis.transaccionesSalteadas.length - 20} más`);
        }
    }

    if (analisis.ventasSalteadas.length > 0) {
        console.log("\n  Ventas de transacciones salteadas (no se cargan):");
        const ids = analisis.ventasSalteadas.map((venta) => venta.id_transaccion);
        console.log(`    ${ids.slice(0, 20).join(", ")}${ids.length > 20 ? " ..." : ""}`);
    }

    if (analisis.ventasSinFila.length > 0) {
        console.log("\n  ATENCIÓN: ventas sin fila en `ventas` (bloqueante):");
        const ids = analisis.ventasSinFila.map((transaccion) => transaccion.id);
        console.log(`    ${ids.slice(0, 20).join(", ")}${ids.length > 20 ? " ..." : ""}`);
    }
}

function imprimirResultadoCarga(resultado: ResultadoCarga): void {
    console.log("\nCarga en Postgres:");
    for (const [nombre, cantidad] of Object.entries(resultado.filas)) {
        console.log(`  ${nombre.padEnd(28)} ${String(cantidad).padStart(8)}`);
    }
}

function hayBloqueantes(analisis: AnalisisDatos, forzar: boolean): boolean {
    if (analisis.ventasSinFila.length > 0) return true;
    if (!forzar && analisis.aperturasPrincipal.some((apertura) => apertura.apertura < 0)) return true;
    return false;
}

async function main(): Promise<void> {
    const opciones = parsearOpciones(process.argv.slice(2));
    const config = crearConfig();

    if (!opciones.desdeJson) {
        console.log(`Origen MySQL: ${config.mysql.host}:${config.mysql.port}/${config.mysql.database}`);
    }
    console.log(`Destino Postgres: ${config.postgres.host}:${config.postgres.port}/${config.postgres.database}`);
    console.log(`Cuentas: ${config.cuentas.join(", ")}`);

    const datos = opciones.desdeJson ? await leerJson(opciones.json) : await extraerDatos(config);
    if (!opciones.desdeJson) await guardarJson(opciones.json, datos);

    const analisis = analizarDatos(datos);
    imprimirConteos(datos);
    imprimirAnomalias(analisis);
    imprimirAperturas(analisis);

    if (opciones.dryRun) {
        if (hayBloqueantes(analisis, opciones.forzar)) {
            console.log("\nDRY-RUN con bloqueantes: no se escribió en Postgres.");
            process.exitCode = 1;
        } else {
            console.log("\nDRY-RUN OK: no se escribió en Postgres.");
        }
        return;
    }

    const resultado = await cargarDatos(config.postgres, datos, analisis, {
        reset: opciones.reset,
        forzar: opciones.forzar
    });
    imprimirResultadoCarga(resultado);

    const verificacion = await verificarDatos(config.postgres, datos, analisis);
    if (verificacion.ok) {
        console.log("\nVERIFICACIÓN OK: 0 diferencias.");
    } else {
        console.log("\nVERIFICACIÓN FALLIDA.");
        process.exitCode = 1;
    }
}

main().catch((error: unknown) => {
    console.error("\nError en la migración:", error);
    process.exit(1);
});
