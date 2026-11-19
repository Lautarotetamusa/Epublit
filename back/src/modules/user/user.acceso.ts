import type { User } from "./user.validator";

const MINUTO_MS = 60 * 1000;
const HORA_MS = 60 * MINUTO_MS;

// Plazos aprobados en specs/026-registro-email (los dicen el front y los mails).
export const VIGENCIA_CONFIRMACION_MS = 24 * HORA_MS;
export const VIGENCIA_RESTABLECER_MS = HORA_MS;
export const ESPERA_ENTRE_ENVIOS_MS = MINUTO_MS;
export const VENTANA_DE_ENVIOS_MS = 15 * MINUTO_MS;
export const MAXIMO_ENVIOS_EN_VENTANA = 3;
export const INTERVALO_LIMPIEZA_MS = HORA_MS;

type EstadoDeConfirmacion = Pick<User, "username_interno" | "email_confirmado" | "confirmacion_enviada_en">;

// Las cuentas viejas nunca quedan pendientes: el requisito de confirmar el
// email es sólo para las del registro nuevo.
export const esPendiente = (user: EstadoDeConfirmacion): boolean => user.username_interno && !user.email_confirmado;

export const esPendienteVencida = (user: EstadoDeConfirmacion, ahora: Date): boolean =>
    esPendiente(user) &&
    user.confirmacion_enviada_en !== null &&
    ahora.getTime() - user.confirmacion_enviada_en.getTime() > VIGENCIA_CONFIRMACION_MS;

export const limiteDePendientesVigentes = (ahora: Date): Date => new Date(ahora.getTime() - VIGENCIA_CONFIRMACION_MS);

// En las cuentas nuevas el username es interno: mostrarlo confundiría.
export const usernameVisible = (user: Pick<User, "username" | "username_interno">): string | null =>
    user.username_interno ? null : user.username;

export const nombreDeCuenta = (user: Pick<User, "razon_social" | "username" | "username_interno">): string => {
    const username = usernameVisible(user);
    return username ? `${user.razon_social} (usuario ${username})` : user.razon_social;
};
