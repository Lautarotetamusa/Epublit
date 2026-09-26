import {Response, Request, NextFunction} from "express"
import { ZodError } from "zod";
import { ServiceError, BadRequest } from "bradb";
import { AfipError } from "../afip/Afip";

// `NotFound`/`Duplicated`/`Forbidden`/`Unauthorized` no se re-exportan
// desde acá: quien los necesite los importa directo de `bradb`, para no
// mantener un alias que sólo reenvía sin agregar nada.

// Alias de `BadRequest` (bradb): mismo status/comportamiento, nombre más
// claro en los call sites de validación de reglas de negocio.
export class ValidationError extends BadRequest {}

// Sólo quedan acá las dos que bradb no tiene: `NothingChanged` (200, no es
// un error real, es un "no había nada que cambiar") y `NotImplemented`
// (501, endpoints todavía no migrados).
export class ApiError extends Error{
    status: number;
    name: string;

    constructor(status: number, message: string, name: string){
        super(message);
        this.status = status;
        this.name = name;
    }
}

export class NothingChanged extends ApiError {
    constructor(message: string){
        super(200, message, "NothingChanged");
    }
}

export class NotImplemented extends ApiError {
    constructor(message: string){
        super(501, message, "NotImplemented");
    }
}

export function handleErrors(err: Error, req: Request, res: Response, next: NextFunction): Response{
    if (err instanceof ZodError){
        const errors = err.issues.map(e => ({
            ...e,
            message: e.code == "invalid_type"
                ? `El campo ${String(e.path[0])} es obligatorio`
                : e.message
        }));

        return res.status(400).json({
            success: false,
            errors: errors
        });
    }

    if (err instanceof NothingChanged) return res.status(err.status).json({
        success: true,
        message: err.message
    });

    if (err instanceof ApiError) return res.status(err.status).json({
        success: false,
        errors: [{
            code: err.name,
            message: err.message
        }]
    });

    // Errores de bradb: `ServiceBuilder` los tira solo (FK/unique violations
    // vía `handleSqlError`), y los controllers/services los tiran directo
    // para sus propias reglas de negocio (`NotFound`/`Duplicated`/
    // `ValidationError`/`Forbidden`/`Unauthorized`, todos `ServiceError`) —
    // no se duplican clases que bradb ya define.
    if (err instanceof ServiceError) return res.status(err.statusCode).json({
        success: false,
        errors: [{
            code: err.name,
            message: err.message
        }]
    });

    if (err instanceof AfipError) return res.status(500).json({
        success: false,
        errors: [{
            code: err.code,
            message: err.message
        }]
    });

    console.error("INTERNAL ERROR: ", err.message, err.stack);
    return res.status(500).json({
        success: false,
        errors: [{
            code: err.name,
            message: "Internal server error"
        }]
    });
}
