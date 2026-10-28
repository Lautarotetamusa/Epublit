import { Request, Response, NextFunction } from "express";
import jwt, { Secret } from "jsonwebtoken";

import * as dotenv from 'dotenv'
import { TokenUser } from "../../modules/user/user.validator";
dotenv.config();

export const auth = async (req: Request, res: Response, next: NextFunction) => {
    const token: string | undefined = req.header("Authorization")?.replace('Bearer ', '');

    if (!token) return res.status(403).json({
        success: false,
        error: "Se necesita un token para acceder a este recurso"
    })

    try{
        const decoded = jwt.verify(token, process.env.JWT_SECRET as Secret);
        res.locals.user = decoded as TokenUser;
        next();
    } catch {
        // Token inválido o vencido: el 401 es la respuesta esperada.
        return res.status(401).json({
            success: false,
            error: "Invalid token"
        });
    }
}

// El contrato de comprobantes exige 401 cuando no hay sesión, mientras que el
// resto del panel responde 403 por el comportamiento histórico de `auth`.
// Se envuelve sólo para esa ruta, sin cambiar el status del resto de la API.
export const authConSesion = async (req: Request, res: Response, next: NextFunction) => {
    const token = req.header("Authorization")?.replace("Bearer ", "").trim();

    if (!token) {
        return res.status(401).json({
            success: false,
            error: "Se necesita un token para acceder a este recurso"
        });
    }

    return auth(req, res, next);
}
