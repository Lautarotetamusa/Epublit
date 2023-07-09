import { Request, Response, NextFunction } from "express";
import { User } from "../models/user.model";
import { ValidationError, parse_error } from '../models/errors';
import { validateUser } from "../schemas/user.schema";

import * as dotenv from 'dotenv'
import bcrypt from "bcrypt";
import jwt, {Secret} from "jsonwebtoken";

const create = async (req: Request, res: Response): Promise<Response> => {
    if (!validateUser.create(req.body)){
       return res.status(400).json({
            success: false,
            error: validateUser.error
        }) 
    }

    try {
        req.body.password = await bcrypt.hash(req.body.password, 10);

        const user = await User.insert(req.body);
        return res.status(200).json({
            success: true,
            message: "Usuario creado correctamente",
            data: user
        });
    } catch (error: any) {
        return parse_error(res, error);
    }
}

const login = async (req: Request, res: Response): Promise<Response> => {
    try {
        if (!validateUser.create(req.body))
            throw new ValidationError(validateUser.error)

        const user = await User.get_one(req.body.username);

        const string_hash: string = Buffer.from(user.password).toString('ascii');

        const valid = await bcrypt.compare(req.body.password, string_hash); 

        if (!valid) return res.status(401).json({
            success: false,
            error: "Contraseña incorrecta"
        })

        const token = jwt.sign(req.body, process.env.JWT_SECRET as Secret, { expiresIn: process.env.JWT_EXPIRES_IN });

        return res.status(200).json({
            success: true,
            message: "login exitoso",
            token: token
        })
    } catch (error: any) {
        return parse_error(res, error);
    }
}

const welcome = async (req: Request, res: Response): Promise<Response> => { 
    return res.status(200).json({
        success: true,
        message: "Ingreso correcto",
    })
}

export default {
    create,
    login,
    welcome,
}
