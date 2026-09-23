import {Response, Request, NextFunction} from "express"
import { ZodError } from "zod";
import { ServiceError } from "bradb";
import { AfipError } from "../afip/Afip";

export class ApiError extends Error{
    status: number;
    name: string;

    constructor(status: number, message: string, name: string){
        super(message);
        this.status = status;
        this.name = name;
    }
}

export class ValidationError extends ApiError {
    constructor(message: string){
        super(400, message, "ValidationError");
    }
}

export class NotFound extends ApiError {
    constructor(message: string){
        super(404, message, "NotFound");
    }
}

export class NothingChanged extends ApiError {
    constructor(message: string){
        super(200, message, "NothingChanged");
    }
}

export class Duplicated extends ApiError {
    constructor(message: string){
        super(404, message, "Duplicated");
    }
}

export class Forbidden extends ApiError {
    constructor(message: string){
        super(403, message, "Forbidden");
    }
}

export class Unauthorized extends ApiError {
    constructor(message: string){
        super(401, message, "Unauthorized");
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

    // Errores de los módulos ya migrados a bradb/Drizzle (ver persona.service.ts).
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
