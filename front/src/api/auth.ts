import { api } from "./client";
import { getApiErrorDetail } from "../lib/errors";

// Email o nombre de usuario: hay cuentas anteriores a la confirmación de
// email que no tienen email y sólo entran con su usuario.
export type LoginInput = {
    identificador: string;
    password: string;
};

// `token` viaja top-level (no en `data`): así responde `POST /user/login`
// (ver back/src/modules/user/user.controller.ts#responderSesion), es la
// excepción al sobre `{success,data}` del resto de la API. Confirmar el email
// y restablecer la contraseña responden la misma sesión.
type SesionResponse = {
    success: true;
    message: string;
    token: string;
};

export type RegisterInput = {
    email: string;
    password: string;
    cuit: string;
};

export type RegisterResponse = {
    success: true;
    message: string;
    data: { email: string };
};

type VerifyEmailResponse = (SesionResponse & { status: "verified" }) | { success: true; status: "already_verified" };

type ResetPasswordStatusResponse = { success: true; status: "valid"; razon_social: string; username: string | null };

export type ConfirmacionEmail =
    | { estado: "confirmado"; token: string }
    | { estado: "ya_confirmado" }
    | { estado: "registro_vencido" }
    | { estado: "vencido"; email: string }
    | { estado: "invalido" };

// Cuenta a la que pertenece un link de restablecer contraseña. `usuario` sólo
// viene en las cuentas anteriores al registro por email (las nuevas tienen un
// username interno que no se muestra).
export type CuentaRestablecimiento = { nombre: string; usuario: string | null };

type LinkNoVigente = { estado: "vencido"; email: string } | { estado: "usado" } | { estado: "invalido" };

export type ConsultaRestablecimiento = { estado: "valido"; cuenta: CuentaRestablecimiento } | LinkNoVigente;

export type Restablecimiento = { estado: "restablecido"; token: string } | LinkNoVigente;

// Códigos estables del contrato (specs/026-registro-email/plan.md): la UI
// decide la copia por ellos, no por el texto del mensaje.
export const AUTH_ERROR = {
    emailNotVerified: "email_not_verified",
    emailTaken: "email_taken",
    cuitTaken: "cuit_taken",
    cuitNotInPadron: "cuit_not_in_padron",
    tooManyRequests: "too_many_requests",
    registrationExpired: "registration_expired",
    tokenExpired: "token_expired",
    tokenUsed: "token_used",
    tokenInvalid: "token_invalid"
} as const;

// Un link del mail que ya no sirve llega como error HTTP (410/409/404), pero
// para la pantalla es un resultado esperable con su propia copia; cualquier
// otro error sigue su curso.
function confirmacionNoVigente(err: unknown): ConfirmacionEmail {
    const detalle = getApiErrorDetail(err);
    if (detalle?.code === AUTH_ERROR.registrationExpired) return { estado: "registro_vencido" };
    if (detalle?.code === AUTH_ERROR.tokenExpired && detalle.email) return { estado: "vencido", email: detalle.email };
    if (detalle?.code === AUTH_ERROR.tokenInvalid) return { estado: "invalido" };
    throw err;
}

function restablecimientoNoVigente(err: unknown): LinkNoVigente {
    const detalle = getApiErrorDetail(err);
    if (detalle?.code === AUTH_ERROR.tokenExpired && detalle.email) return { estado: "vencido", email: detalle.email };
    if (detalle?.code === AUTH_ERROR.tokenUsed) return { estado: "usado" };
    if (detalle?.code === AUTH_ERROR.tokenInvalid) return { estado: "invalido" };
    throw err;
}

export const login = ({ identificador, password }: LoginInput): Promise<SesionResponse> =>
    api.post("/user/login", { identifier: identificador, password });

export const register = (input: RegisterInput): Promise<RegisterResponse> => api.post("/user/register", input);

export const reenviarConfirmacion = (email: string): Promise<void> => api.post("/user/resend-verification", { email });

export const confirmarEmail = (token: string): Promise<ConfirmacionEmail> =>
    api
        .post<VerifyEmailResponse>("/user/verify-email", { token })
        .then(
            (respuesta): ConfirmacionEmail =>
                respuesta.status === "verified" ? { estado: "confirmado", token: respuesta.token } : { estado: "ya_confirmado" },
            confirmacionNoVigente
        );

export const pedirRestablecimiento = (email: string): Promise<void> => api.post("/user/forgot-password", { email });

export const consultarRestablecimiento = (token: string): Promise<ConsultaRestablecimiento> =>
    api
        .get<ResetPasswordStatusResponse>(`/user/reset-password/${encodeURIComponent(token)}`)
        .then(
            (respuesta): ConsultaRestablecimiento => ({
                estado: "valido",
                cuenta: { nombre: respuesta.razon_social, usuario: respuesta.username }
            }),
            restablecimientoNoVigente
        );

export const restablecerContrasena = (token: string, password: string): Promise<Restablecimiento> =>
    api
        .post<SesionResponse>("/user/reset-password", { token, password })
        .then((respuesta): Restablecimiento => ({ estado: "restablecido", token: respuesta.token }), restablecimientoNoVigente);
