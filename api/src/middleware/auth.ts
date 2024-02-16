import { Request, Response, NextFunction } from "express";
import jwt, { Secret } from "jsonwebtoken";

import * as dotenv from 'dotenv'
dotenv.config();

export const auth = async (req: Request, res: Response, next: NextFunction) => {
    const token: string | undefined = req.header("Authorization")?.replace('Bearer ', '');

    if (!token) return res.status(403).json({
        success: false,
        error: "Se necesita un token para acceder a este recurso"
    })

    try{
        const decoded = jwt.verify(token, process.env.JWT_SECRET as Secret);
        res.locals.user = decoded;
        next();
    }catch(err: any){
        return res.status(401).json({
            success: false,
            error: "Invalid token"
        });
    }
}
