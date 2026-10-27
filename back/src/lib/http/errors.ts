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
    // Datos extra del rechazo (ej. qué libros no alcanzan) que el contrato
    // necesita devolver además del mensaje: `handleErrors` los aplana dentro
    // del error del sobre `{success:false, errors:[...]}`.
    details?: Record<string, unknown>;

    constructor(status: number, message: string, name: string, details?: Record<string, unknown>){
        super(message);
        this.status = status;
        this.name = name;
        this.details = details;
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

// Tipo de archivo no soportado (ej. portada que no es JPG/PNG).
export class UnsupportedMediaType extends ApiError {
    constructor(message: string){
        super(415, message, "UnsupportedMediaType");
    }
}

// Archivo subido más grande de lo permitido (ej. portada > 5 MB).
export class PayloadTooLarge extends ApiError {
    constructor(message: string){
        super(413, message, "PayloadTooLarge");
    }
}

// Archivo bien formado pero con un contenido que no cumple una regla de
// negocio (ej. foto de persona por debajo de la resolución mínima
// configurada, ver specs/004-persona-foto-bio).
export class UnprocessableEntity extends ApiError {
    constructor(message: string){
        super(422, message, "UnprocessableEntity");
    }
}

// La operación choca con una regla de negocio del estado actual (ej. borrar
// una colección que todavía tiene libros, ver specs/007-colecciones).
export class Conflict extends ApiError {
    constructor(message: string){
        super(409, message, "Conflict");
    }
}

// Un proveedor externo (Correo Argentino, MercadoPago) no respondió o
// devolvió un error. No se expone el detalle crudo al cliente.
export class BadGateway extends ApiError {
    constructor(message: string){
        super(502, message, "BadGateway");
    }
}

export class ExternalServiceError extends Error {
    constructor(
        public readonly provider: string,
        message: string,
        public readonly status?: number,
        public readonly details?: unknown
    ){
        super(message);
        this.name = "ExternalServiceError";
    }
}

// Movimiento rechazado por saldo insuficiente en el depósito origen: además
// del mensaje lleva el detalle libro por libro (pedido vs disponible).
export type LibroSinStock = { isbn: string; titulo: string; pedido: number; disponible: number };

export class StockInsuficiente extends ApiError {
    constructor(message: string, libros: LibroSinStock[]){
        super(409, message, "StockInsuficiente", { libros });
    }
}

// Borrado de un depósito bloqueado porque todavía tiene stock: el rechazo
// incluye las cifras que lo bloquean, para que la pantalla pueda mostrarlas.
export class DepositoConStock extends ApiError {
    constructor(message: string, ejemplares: number, titulos: number){
        super(409, message, "DepositoConStock", { ejemplares, titulos });
    }
}

// Borrado del depósito principal (403, distinguible del 409 de "tiene stock").
export class DepositoPrincipal extends ApiError {
    constructor(message: string){
        super(403, message, "DepositoPrincipal");
    }
}

// `next` es obligatorio en la firma aunque no se use: Express reconoce un
// manejador de errores por su aridad de 4 argumentos, no por el nombre del
// parámetro; quitarlo haría que el handler dejara de recibir los errores.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
            message: err.message,
            ...err.details
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

    // La respuesta del proveedor (ej. `invalid_client` de MercadoPago) solo va
    // al log: puede traer datos de la cuenta y al cliente no le sirve.
    if (err instanceof ExternalServiceError) {
        console.error(`EXTERNAL ERROR [${err.provider}]:`, err.message, err.details);
        return res.status(502).json({
            success: false,
            errors: [{
                code: "BadGateway",
                message: err.message
            }]
        });
    }

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
