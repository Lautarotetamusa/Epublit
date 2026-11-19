import { z } from "zod";
import { ApiError } from "../../lib/http/errors";

export type CampoDeAcceso = "email" | "password" | "cuit" | "username";

// `code` es el contrato con el front (decide la copia y el campo por él), no
// el nombre de la clase: por eso cada caso es una instancia y no una subclase.
export class ErrorDeAcceso extends ApiError {
    constructor(status: number, code: string, message: string, details?: { field?: CampoDeAcceso; email?: string | null }) {
        super(status, message, code, details);
    }
}

export const erroresDeAcceso = {
    emailInvalido: () => new ErrorDeAcceso(400, "invalid_email", "El email no es válido", { field: "email" }),
    passwordCorta: () =>
        new ErrorDeAcceso(400, "password_too_short", "La contraseña tiene que tener al menos 8 caracteres", { field: "password" }),
    cuitInvalido: () =>
        new ErrorDeAcceso(400, "invalid_cuit", "El CUIT tiene que tener 11 dígitos y un dígito verificador válido", { field: "cuit" }),
    emailTomado: () => new ErrorDeAcceso(409, "email_taken", "Ya hay una cuenta con este email", { field: "email" }),
    cuitTomado: () => new ErrorDeAcceso(409, "cuit_taken", "Ya hay una cuenta con este CUIT", { field: "cuit" }),
    cuitFueraDelPadron: () =>
        new ErrorDeAcceso(422, "cuit_not_in_padron", "Este CUIT no figura en el padrón de ARCA", { field: "cuit" }),
    padronCaido: () =>
        new ErrorDeAcceso(502, "padron_unavailable", "No pudimos consultar el padrón de ARCA. Probá de nuevo en unos minutos"),
    credencialesInvalidas: () => new ErrorDeAcceso(401, "invalid_credentials", "El email, el usuario o la contraseña no son correctos"),
    emailSinConfirmar: (email: string | null) =>
        new ErrorDeAcceso(403, "email_not_verified", "Todavía no confirmaste tu email", { email }),
    registroVencido: () => new ErrorDeAcceso(410, "registration_expired", "Tu registro venció. Registrate de nuevo"),
    tokenVencido: (email: string | null) => new ErrorDeAcceso(410, "token_expired", "El link venció", { email }),
    tokenUsado: () => new ErrorDeAcceso(409, "token_used", "Este link ya se usó"),
    tokenInvalido: () => new ErrorDeAcceso(404, "token_invalid", "Este link no es válido"),
    demasiadosPedidos: () =>
        new ErrorDeAcceso(429, "too_many_requests", "Ya pediste varios links seguidos. Esperá unos minutos y probá de nuevo")
};

const ERROR_POR_CAMPO: Record<string, () => ErrorDeAcceso> = {
    email: erroresDeAcceso.emailInvalido,
    password: erroresDeAcceso.passwordCorta,
    cuit: erroresDeAcceso.cuitInvalido
};

// Las rutas de acceso devuelven el primer error con su `code`/`field` del
// contrato en vez del sobre genérico de zod (ver specs/026-registro-email).
export function parsearAcceso<S extends z.ZodType>(schema: S, body: unknown): z.infer<S> {
    const resultado = schema.safeParse(body ?? {});
    if (resultado.success) return resultado.data;

    const errorDelCampo = ERROR_POR_CAMPO[String(resultado.error.issues[0].path[0])];
    throw errorDelCampo ? errorDelCampo() : resultado.error;
}
