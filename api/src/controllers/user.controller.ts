import { Request, Response } from "express";
import { User } from "../models/user.model";
import { validateUser } from "../schemas/user.schema";

import bcrypt from "bcrypt";
import jwt, {Secret} from "jsonwebtoken";
import { ValidationError } from "../models/errors";

const create = async (req: Request, res: Response): Promise<Response> => {
    let valid = validateUser.create(req.body);

    if (await User.exists(valid.username))
        throw new ValidationError("Ya existe un cliente con este cuit y este username");
    
    valid.password = await bcrypt.hash(valid.password, 10);

    const user = await User.insert(valid);
    return res.status(201).json({
        success: true,
        message: "Usuario creado correctamente",
        data: user
    });
}

const login = async (req: Request, res: Response): Promise<Response> => {
    let valid = validateUser.login(req.body);
    const user = await User.get_one(valid.username);
    let match = await bcrypt.compare(valid.password, Buffer.from(user.password).toString('ascii'));
    
    if (!match) return res.status(401).json({
        success: false,
        error: "Contraseña incorrecta"
    });

    const token = jwt.sign({
        id: user.id,
        username: user.username,
        razon_social: user.razon_social,
        domicilio: user.domicilio,
        cond_fiscal: user.cond_fiscal,
        cuit: user.cuit
    }, process.env.JWT_SECRET as Secret, 
    { expiresIn: process.env.JWT_EXPIRES_IN });

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
        data: res.locals.user
    });
}

export default {
    create,
    login,
    welcome,
}
