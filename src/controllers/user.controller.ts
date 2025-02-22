import { Request, Response } from "express";
import { User } from "../models/user.model";

import bcrypt from "bcrypt";
import jwt, {Secret} from "jsonwebtoken";
import { Unauthorized, ValidationError } from "../models/errors";
import { createUser, loginUser } from "../schemas/user.schema";
import { getAfipData } from "../afip/Afip";
import { StringValue } from "ms";

const create = async (req: Request, res: Response): Promise<Response> => {
    const body = createUser.parse(req.body);

    if (await User.exists(body.username)){
        throw new ValidationError("Ya existe un usuario con este username");
    }
    body.password = await bcrypt.hash(body.password, 10);
    const afipData = await getAfipData(body.cuit);

    const user = await User.insert({
        ...body,
        ...afipData,
        production: 0 //Si lo quiero hacer true lo tengo que hacer manualmente 
    });
    return res.status(201).json({
        success: true,
        message: "Usuario creado correctamente",
        data: user
    });
}

const updateAfipData = async (req: Request, res: Response): Promise<Response> => {
    const user = await User.getOne(res.locals.user.username);
    const afipData = await getAfipData(user.cuit);
    await user.update(afipData);

    return res.status(200).json({
        success: true,
        message: "Usuario actualizado correctamente",
        data: user
    });
};

const login = async (req: Request, res: Response): Promise<Response> => {
    const body = loginUser.parse(req.body);
    const user = await User.getOne(body.username);
    const match = await bcrypt.compare(body.password, Buffer.from(user.password).toString('ascii'));
    
    if (!match) throw new Unauthorized("Contraseña incorrecta");

    const opts: jwt.SignOptions = { 
        expiresIn: process.env.JWT_EXPIRES_IN as StringValue
    }

    const payload = {
        id: user.id,
        username: user.username,
        razon_social: user.razon_social,
        domicilio: user.domicilio,
        cond_fiscal: user.cond_fiscal,
        cuit: user.cuit,
        production: user.production,
    }

    const secret = process.env.JWT_SECRET as Secret;

    // TODO: do not use process here, set it in main
    const token = jwt.sign(payload, secret, opts)

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
    updateAfipData
}
