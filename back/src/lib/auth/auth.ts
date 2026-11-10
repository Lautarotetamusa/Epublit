import { Request, RequestHandler, Response } from "express";
import jwt, { Secret } from "jsonwebtoken";

import * as dotenv from 'dotenv'
import { TokenUser } from "../../modules/user/user.validator";
dotenv.config();

export type SessionAuthHandlers = {
    onMissing: (res: Response) => Response;
    onInvalid: (res: Response) => Response;
};

// Fábrica para que cada router elija el sobre de sus rechazos sin duplicar la
// verificación del JWT; el comportamiento histórico de `auth` se conserva.
export function createSessionAuth({ onMissing, onInvalid }: SessionAuthHandlers): RequestHandler {
    return async (req: Request, res: Response, next) => {
        const token: string | undefined = req.header("Authorization")?.replace('Bearer ', '');

        if (!token) return onMissing(res);

        try{
            const decoded = jwt.verify(token, process.env.JWT_SECRET as Secret);
            res.locals.user = decoded as TokenUser;
            next();
        } catch {
            // Token inválido o vencido: el 401 es la respuesta esperada.
            return onInvalid(res);
        }
    }
}

export const auth = createSessionAuth({
    onMissing: (res) => res.status(403).json({
        success: false,
        error: "Se necesita un token para acceder a este recurso"
    }),
    onInvalid: (res) => res.status(401).json({
        success: false,
        error: "Invalid token"
    })
});

// El contrato de comprobantes exige 401 cuando no hay sesión, mientras que el
// resto del panel responde 403 por el comportamiento histórico de `auth`.
// Se envuelve sólo para esa ruta, sin cambiar el status del resto de la API.
export const authConSesion = createSessionAuth({
    onMissing: (res) => res.status(401).json({
        success: false,
        error: "Se necesita un token para acceder a este recurso"
    }),
    onInvalid: (res) => res.status(401).json({
        success: false,
        error: "Invalid token"
    })
});
