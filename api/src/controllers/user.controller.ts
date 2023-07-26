import { Request, Response } from "express";
import { User } from "../models/user.model";
import { ValidationError } from '../models/errors';
import { validateUser } from "../schemas/user.schema";

import bcrypt from "bcrypt";
import jwt, {Secret} from "jsonwebtoken";

const create = async (req: Request, res: Response): Promise<Response> => {
    let valid = validateUser.create(req.body)

    req.body.password = await bcrypt.hash(valid.password, 10);

    const user = await User.insert(valid);
    return res.status(200).json({
        success: true,
        message: "Usuario creado correctamente",
        data: user
    });
}

const login = async (req: Request, res: Response): Promise<Response> => {
    let valid = validateUser.create(req.body);
    const user = await User.get_one(valid.username);
    const string_hash: string = Buffer.from(user.password).toString('ascii');

    if (valid.password !== string_hash) return res.status(401).json({
        success: false,
        error: "Contraseña incorrecta"
    })

    const token = jwt.sign(valid, process.env.JWT_SECRET as Secret, { expiresIn: process.env.JWT_EXPIRES_IN });

    return res.status(200).json({
        success: true,
        message: "login exitoso",
        token: token
    });
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
