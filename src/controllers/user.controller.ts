import { Request, Response } from "express";
import { User } from "../models/user.model";

import bcrypt from "bcrypt";
import jwt, {Secret} from "jsonwebtoken";
import { Unauthorized, ValidationError } from "../models/errors";
import { createUser, loginUser, updateUser } from "../schemas/user.schema";
import { createCSR, createKey, createUserFolder, getAfipData, getCertPath, isValidCert, removeCert, saveCert } from "../afip/Afip";
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
        production: 0 // Si lo quiero hacer true lo tengo que hacer manualmente 
    });

    // This can be a promise chain and create the files in the background
    // but the time difference its not significant
    // furthermore, bringing the afip data takes a long time anyway
    await createUserFolder(user.cuit);
    await createKey(user.cuit);
    await createCSR(user);
    
    return res.status(201).json({
        success: true,
        message: "Usuario creado correctamente",
        data: user
    });
}


const update = async (req: Request, res: Response): Promise<Response> => {
    const body = updateUser.parse(req.body);

    // object its empty
    if (Object.keys(body).length == 0) {
        return res.status(200).json({
            success: true,
            message: "El usuario esta igual que antes",
        });
    }

    const user = await User.getById(res.locals.user.id);
    await user.update(body);

    return res.status(200).json({
        success: true,
        message: "Usuario actualizado correctamente",
        data: user
    });
}

const updateAfipData = async (req: Request, res: Response): Promise<Response> => {
    const user = await User.getById(res.locals.user.id);
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
    const password = await User.getPassword(user.id);
    const match = await bcrypt.compare(body.password, Buffer.from(password).toString('ascii'));
    
    if (!match) throw new Unauthorized("Contraseña incorrecta");

    const opts: jwt.SignOptions = { 
        expiresIn: process.env.JWT_EXPIRES_IN as StringValue
    }

    const token_data = {
        id: user.id,
        cuit: user.cuit,
    }

    // TODO: do not use process here, set it in main
    const secret = process.env.JWT_SECRET as Secret;

    const token = jwt.sign(token_data, secret, opts)

    return res.status(200).json({
        success: true,
        message: "login exitoso",
        token: token
    });
}

const uploadCert = async (req: Request, res: Response): Promise<Response> => {
    if (!req.file) throw new ValidationError("El campo 'cert' es necesario")

    if (req.file.mimetype != "application/x-x509-ca-cert") 
        throw new ValidationError("El tipo de archivo del certificado es invalido")

    const certPath = getCertPath(res.locals.user.cuit);

    await saveCert(certPath, req.file.buffer);
    const isValid = await isValidCert(certPath);
    if (!isValid) { // Si no es valido eliminamos el archivo
        await removeCert(certPath);
        throw new ValidationError("El certificado no es valido");
    }

    return res.status(201).json({
        success: true,
        message: "Certificado subido correctamente"
    })
}

const getOne = async (req: Request, res: Response): Promise<Response> => { 
    const user = await User.getById(res.locals.user.id);

    return res.status(200).json({
        success: true,
        data: user
    });
}

export default {
    create,
    login,
    update,
    getOne,
    uploadCert,
    updateAfipData
}
