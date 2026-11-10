import { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ServiceError } from "bradb";
import { ZodError } from "zod";
import { ApiError } from "../../lib/http/errors";
import { PublicApiError } from "../tienda";

export type ContenidoDetalle = {
    campo: string;
    codigo: string;
    mensaje: string;
};

// El contrato del CMS usa el mismo sobre estable que la API pública de la
// tienda (`{ error: { codigo, mensaje, detalles } }`), también en el panel.
export class ContenidoError extends Error {
    constructor(
        public readonly status: number,
        public readonly codigo: string,
        public readonly mensaje: string,
        public readonly detalles: ContenidoDetalle[] = []
    ) {
        super(mensaje);
        this.name = "ContenidoError";
    }
}

export function sendContenidoError(
    res: Response,
    status: number,
    codigo: string,
    mensaje: string,
    detalles: ContenidoDetalle[] = []
): Response {
    return res.status(status).json({
        error: {
            codigo,
            mensaje,
            detalles
        }
    });
}

const codigoDeIssue = (issue: ZodError["issues"][number]): string => {
    if (issue.path[0] === "slug") return "slug_invalido";
    if (issue.path[0] === "bloques") return "bloque_invalido";
    return "validacion";
};

const detallesDeZod = (err: ZodError): ContenidoDetalle[] =>
    err.issues.map((issue) => ({
        campo: issue.path.join(".") || "body",
        codigo: codigoDeIssue(issue),
        mensaje: issue.message
    }));

const codigoPrincipal = (detalles: ContenidoDetalle[]): string =>
    detalles.find((detalle) => detalle.codigo !== "validacion")?.codigo ?? "validacion";

const errorDeServicio = (err: ServiceError): [number, string] => {
    if (err.statusCode === 404) return [404, "no_encontrado"];
    if (err.statusCode === 401) return [401, "no_autenticado"];
    if (err.statusCode === 403) return [403, "origen_no_permitido"];
    if (err.statusCode === 409) return [409, "conflicto"];
    return [err.statusCode, "validacion"];
};

// `next` es obligatorio para que Express reconozca el handler de errores por
// su aridad de 4 argumentos (mismo criterio que `handleErrors`).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function handleContenidoErrors(err: Error, req: Request, res: Response, next: NextFunction): Response {
    if (err instanceof ContenidoError) {
        return sendContenidoError(res, err.status, err.codigo, err.mensaje, err.detalles);
    }

    if (err instanceof PublicApiError) {
        return sendContenidoError(
            res,
            err.status,
            err.codigo,
            err.mensaje,
            err.detalles as ContenidoDetalle[]
        );
    }

    if (err instanceof ZodError) {
        const detalles = detallesDeZod(err);
        return sendContenidoError(
            res,
            400,
            codigoPrincipal(detalles),
            "Los datos enviados no son válidos",
            detalles
        );
    }

    if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
            return sendContenidoError(
                res,
                413,
                "archivo_demasiado_grande",
                "La imagen no puede pesar más de 8 MB"
            );
        }

        return sendContenidoError(res, 400, "archivo_invalido", "No se pudo leer el archivo");
    }

    if (err instanceof ServiceError) {
        const [status, codigo] = errorDeServicio(err);
        return sendContenidoError(res, status, codigo, err.message);
    }

    if (err instanceof ApiError) {
        return sendContenidoError(res, err.status, "validacion", err.message);
    }

    console.error("INTERNAL CONTENIDO ERROR: ", err.message, err.stack);
    return sendContenidoError(res, 500, "error_interno", "Error interno");
}
