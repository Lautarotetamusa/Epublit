import { fechaDeFecha, formatearDia, mesDeFecha, ultimoDiaDelMes, ultimosMeses } from "../../lib/fechaArgentina";
import { AdminRepository, CuentaListado, CuentaSerie, ResumenAdmin, Ventana } from "./admin.repository";
import { FiltrosCuentas, POR_PAGINA } from "./admin.validator";

export type AdminServiceDeps = {
    repository: AdminRepository;
    // Inyectado para que los tests fijen el reloj sin esperar 30 días.
    ahora?: () => Date;
};

const DIAS_VENTANA = 30;
const MS_POR_DIA = 24 * 60 * 60 * 1000;
const MESES_SERIE = 6;

export type PeriodoAdmin = { desde: string; hasta: string };

export type ResumenAdminService = ResumenAdmin & { periodo: PeriodoAdmin };

export type EmbudoAdmin = Pick<ResumenAdmin, "cuentas" | "conLibro" | "conVenta">;

export type EtapasSerie = {
    soloRegistrado: number;
    cargoLibros: number;
    cargoMovimientos: number;
};

export type PuntoSerie = {
    mes: string;
    total: number;
    etapas: EtapasSerie;
};

export type SerieAdmin = { puntos: PuntoSerie[] };

export type CuentaAdmin = CuentaListado;

export type ListadoAdmin = {
    cuentas: CuentaAdmin[];
    total: number;
    pagina: number;
    porPagina: number;
};

const ventanaDe = (ahora: Date): Ventana => ({
    desde: new Date(ahora.getTime() - DIAS_VENTANA * MS_POR_DIA),
    hasta: ahora
});

// La etapa no puede ser anterior al alta: una fecha conocida anterior se
// reemplaza por el alta. Si el libro no tiene fecha conocida, se usa el alta
// (o el primer mes de la ventana si tampoco hay alta) como cota inferior.
const fechaConCota = (fecha: string | null | undefined, alta: string | null, cotaSinFecha: string): string | null => {
    const base = fecha ?? alta ?? cotaSinFecha;
    return alta && base < alta ? alta : base;
};

const etapaAlCierre = (cuenta: CuentaSerie, cierre: string, cotaSinFecha: string): keyof EtapasSerie => {
    const fechaLibro = cuenta.tieneLibro
        ? fechaConCota(cuenta.primeraFechaLibro, cuenta.alta, cotaSinFecha)
        : null;
    const fechaMovimiento = cuenta.primeraFechaMovimiento
        ? fechaConCota(cuenta.primeraFechaMovimiento, cuenta.alta, cotaSinFecha)
        : null;

    if (fechaMovimiento && fechaMovimiento <= cierre) return "cargoMovimientos";
    if (fechaLibro && fechaLibro <= cierre) return "cargoLibros";
    return "soloRegistrado";
};

// La base se compone acumulativamente: cada cuenta confirmada aparece una vez
// por mes en su etapa máxima alcanzada hasta ese cierre. No es una cohorte por
// mes de alta y no usa la ventana de 30 días.
const puntosDeSerie = (base: CuentaSerie[], ahora: Date): PuntoSerie[] => {
    const meses = ultimosMeses(mesDeFecha(ahora), MESES_SERIE);
    const cierreActual = fechaDeFecha(ahora);
    const cotaSinFecha = formatearDia(meses[0], 1);

    return meses.map((mes, indice) => {
        const cierre = indice === meses.length - 1 ? cierreActual : formatearDia(mes, ultimoDiaDelMes(mes));
        const etapas: EtapasSerie = { soloRegistrado: 0, cargoLibros: 0, cargoMovimientos: 0 };

        for (const cuenta of base) {
            if (cuenta.alta && cuenta.alta > cierre) continue;
            etapas[etapaAlCierre(cuenta, cierre, cotaSinFecha)] += 1;
        }

        return {
            mes,
            total: etapas.soloRegistrado + etapas.cargoLibros + etapas.cargoMovimientos,
            etapas
        };
    });
};

export function createAdminService({ repository, ahora = () => new Date() }: AdminServiceDeps) {
    const resumen = async (momento = ahora()): Promise<ResumenAdminService> => {
        const ventana = ventanaDe(momento);
        const cifras = await repository.resumen(ventana);

        return {
            periodo: { desde: fechaDeFecha(ventana.desde), hasta: fechaDeFecha(momento) },
            ...cifras
        };
    };

    const embudo = async (momento = ahora()): Promise<EmbudoAdmin> => {
        const { cuentas, conLibro, conVenta } = await resumen(momento);
        return { cuentas, conLibro, conVenta };
    };

    const serie = async (momento = ahora()): Promise<SerieAdmin> => ({
        puntos: puntosDeSerie(await repository.baseSerie(), momento)
    });

    const cuentas = async (filtros: FiltrosCuentas, momento = ahora()): Promise<ListadoAdmin> => {
        const { cuentas: filas, total } = await repository.listar(ventanaDe(momento), filtros);

        return { cuentas: filas, total, pagina: filtros.pagina, porPagina: POR_PAGINA };
    };

    return { resumen, embudo, serie, cuentas };
}

export type AdminService = ReturnType<typeof createAdminService>;
