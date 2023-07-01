import { Request, Response, NextFunction } from "express";
import jwt, { Secret } from "jsonwebtoken";

import * as dotenv from 'dotenv'
dotenv.config();

if (!process.env.JWT_SECRET){
    console.log("Error: la variable JWT_SECRET no está seteada");
    process.exit(1);
}

export const auth = async (req: Request, res: Response, next: NextFunction) => { 
    const token: string | undefined = req.header("Authorization")?.replace('Bearer ', '');

    if (!token) return res.status(403).json({
        success: false,
        error: "Se necesita un token para acceder a este recurso"
    })

    try{
        const decoded = jwt.verify(token, process.env.JWT_SECRET as Secret);
        next();
    }catch(err: any){
        return res.status(401).json({
            success: false,
            error: "Invalid token"
        });
    }
}
