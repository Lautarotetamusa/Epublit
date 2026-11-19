import { INTERVALO_LIMPIEZA_MS } from "./user.acceso";

export type LimpiezaDeCuentasDeps = {
    limpiar: () => Promise<void>;
    intervaloMs?: number;
    // Inyectable para verificar el intervalo sin esperar una hora.
    programar?: (tarea: () => void, intervaloMs: number) => void;
};

const programarConSetInterval = (tarea: () => void, intervaloMs: number) => {
    setInterval(tarea, intervaloMs).unref();
};

// Dentro del proceso del back y no en un cron externo: las cuentas pendientes
// vencidas no se acumulan aunque nadie más configure nada. Corre también al
// arrancar para no esperar la primera hora después de un deploy.
export function startLimpiezaCuentasPendientes({
    limpiar,
    intervaloMs = INTERVALO_LIMPIEZA_MS,
    programar = programarConSetInterval
}: LimpiezaDeCuentasDeps): void {
    const limpiarSinCortarElProceso = () => {
        limpiar().catch((error: unknown) => console.error("[cuentas] falló la limpieza de pendientes vencidas", error));
    };

    limpiarSinCortarElProceso();
    programar(limpiarSinCortarElProceso, intervaloMs);
}
