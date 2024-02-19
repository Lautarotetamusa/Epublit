import { Request, Response } from "express";
import { User } from "../models/user.model";

import bcrypt from "bcrypt";
import jwt, {Secret} from "jsonwebtoken";
import { ValidationError } from "../models/errors";
import { createUser, loginUser } from "../schemas/user.schema";
import { getAfipData } from "../afip/Afip";

const create = async (req: Request, res: Response): Promise<Response> => {
    const body = createUser.parse(req.body);

    if (await User.exists(body.username)){
        throw new ValidationError("Ya existe un cliente con este cuit y este username");
    }
    body.password = await bcrypt.hash(body.password, 10);
    const afipData = await getAfipData(body.cuit);

    const user = await User.insert({
        ...body,
        ...afipData
    });
    return res.status(201).json({
        success: true,
        message: "Usuario creado correctamente",
        data: user
    });
}

const login = async (req: Request, res: Response): Promise<Response> => {
    const body = loginUser.parse(req.body);
    const user = await User.getOne(body.username);
    const match = await bcrypt.compare(body.password, Buffer.from(body.password).toString('ascii'));
    
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
