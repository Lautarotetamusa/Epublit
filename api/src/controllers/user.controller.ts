import { Request, Response, NextFunction } from "express";
import { User } from "../models/user.model";
import { ValidationError, parse_error } from '../models/errors';
import { validateUser } from "../schemas/user.schema";

import * as dotenv from 'dotenv'
import bcrypt from "bcrypt";
import jwt, {Secret} from "jsonwebtoken";

const create = async (req: Request, res: Response): Promise<Response> => {
    try {
        let valid = validateUser.create(req.body)
        if (valid.error !== null)
            throw new ValidationError(valid.error)

        req.body.password = await bcrypt.hash(valid.obj.password, 10);

        const user = await User.insert(valid.obj);
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
        let is_valid = validateUser.create(req.body);
        if (is_valid.error !== null)
            throw new ValidationError(is_valid.error)

        const user = await User.get_one(is_valid.obj.username);

        const string_hash: string = Buffer.from(user.password).toString('ascii');

        const valid = await bcrypt.compare(is_valid.obj.password, string_hash); 

        if (!valid) return res.status(401).json({
            success: false,
            error: "Contraseña incorrecta"
        })

        const token = jwt.sign(is_valid.obj, process.env.JWT_SECRET as Secret, { expiresIn: process.env.JWT_EXPIRES_IN });

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
