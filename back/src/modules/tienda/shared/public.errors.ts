import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ServiceError } from "bradb";
import { StockInsuficiente, ApiError } from "../../../lib/http/errors";

export type PublicErrorCode =
    | "no_autenticado"
    | "origen_no_permitido"
    | "integracion_inactiva"
    | "validacion"
    | "no_encontrado"
    | "idempotencia_conflicto"
    | "stock_insuficiente"
    | "transicion_invalida"
    | "pago_no_aprobado"
    | "entrega_no_disponible"
    | "peso_faltante"
    | "correo_no_configurado"
    | "direccion_invalida"
    | "sin_envio"
    | "mercadopago_no_conectado"
    | "proveedor_no_disponible"
    | "no_implementado"
    | "limite_excedido"
    | "error_interno";

// Error de la API pública: además del status HTTP lleva el código estable del
// contrato y la lista de detalles. El adapter nunca deja escapar stack, claves
// ni tokens (ver specs/016-tienda-ecommerce).
export class PublicApiError extends Error {
    constructor(
        public readonly status: number,
        public readonly codigo: PublicErrorCode,
        public readonly mensaje: string,
        public readonly detalles: unknown[] = []
    ) {
        super(mensaje);
        this.name = "PublicApiError";
    }
}

export function sendPublicError(
    res: Response,
    status: number,
    codigo: PublicErrorCode,
    mensaje: string,
    detalles: unknown[] = []
): Response {
    return res.status(status).json({
        error: {
            codigo,
            mensaje,
            detalles
        }
    });
}

const errorDeServicio = (err: ServiceError): PublicApiError => {
    if (err.statusCode === 404) {
        return new PublicApiError(404, "no_encontrado", err.message);
    }
    if (err.statusCode === 401) {
        return new PublicApiError(401, "no_autenticado", err.message);
    }
    if (err.statusCode === 403) {
        return new PublicApiError(403, "origen_no_permitido", err.message);
    }
    return new PublicApiError(err.statusCode, "validacion", err.message);
};

// `next` es obligatorio para que Express reconozca el handler de errores por
// su aridad de 4 argumentos (mismo criterio que `handleErrors`).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function handlePublicErrors(err: Error, req: Request, res: Response, next: NextFunction): Response {
    if (err instanceof PublicApiError) {
        return sendPublicError(res, err.status, err.codigo, err.mensaje, err.detalles);
    }

    if (err instanceof ZodError) {
        return sendPublicError(
            res,
            400,
            "validacion",
            "Los datos enviados no son válidos",
            err.issues.map((issue) => ({ campo: issue.path.join("."), mensaje: issue.message }))
        );
    }

    if (err instanceof StockInsuficiente) {
        const libros = Array.isArray(err.details?.libros) ? err.details.libros : [];
        return sendPublicError(res, err.status, "stock_insuficiente", err.message, libros);
    }

    if (err instanceof ServiceError) {
        const mapped = errorDeServicio(err);
        return sendPublicError(res, mapped.status, mapped.codigo, mapped.mensaje);
    }

    if (err instanceof ApiError) {
        return sendPublicError(res, err.status, "validacion", err.message, err.details ? [err.details] : []);
    }

    console.error("INTERNAL PUBLIC ERROR: ", err.message, err.stack);
    return sendPublicError(res, 500, "error_interno", "Error interno");
}
