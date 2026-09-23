import { Request, Response } from "express";

import bcrypt from "bcrypt";
import jwt, {Secret} from "jsonwebtoken";
import { Unauthorized, ValidationError } from "../models/errors";
import { userService } from "../services/user.service";
import { userValidator, loginUserValidator, createUserValidator } from "../validators/user.validator";
import { createCSR, createKey, createUserFolder, getAfipData, getCertPath, isValidCert, removeCert, saveCert } from "../afip/Afip";
import { StringValue } from "ms";

const create = async (req: Request, res: Response): Promise<Response> => {
    const body = createUserValidator.parse(req.body);

    if (await userService.existsByUsername(body.username)){
        throw new ValidationError("Ya existe un usuario con este username");
    }
    if (await userService.existsByCuit(body.cuit)){
        throw new ValidationError("Ya existe un usuario con este cuit");
    }

    body.password = await bcrypt.hash(body.password, 10);
    const afipData = await getAfipData(body.cuit);

    const user = await userService.createUser({
        ...body,
        ...afipData,
        production: false
    });

    // Los pasos de filesystem/AFIP no son parte de la transacción Postgres
    // que ya creó el usuario y sus clientes por defecto: si alguno falla acá,
    // hay que revertir esa transacción a mano para no dejar datos parciales
    // (caso borde del spec).
    try {
        await createUserFolder(user.cuit);
        await createKey(user.cuit);
        await createCSR(user);
    } catch (err) {
        await userService.remove({ id: user.id });
        throw err;
    }

    return res.status(201).json({
        success: true,
        message: "Usuario creado correctamente",
        data: user
    });
}


const update = async (req: Request, res: Response): Promise<Response> => {
    const body = userValidator.update.parse(req.body);

    if (Object.keys(body).length == 0) {
        return res.status(200).json({
            success: true,
            message: "El usuario esta igual que antes",
        });
    }

    const updated = await userService.update({ id: res.locals.user.id }, body);
    const user = userValidator.select.parse(updated);

    return res.status(200).json({
        success: true,
        message: "Usuario actualizado correctamente",
        data: user
    });
}

const updateAfipData = async (req: Request, res: Response): Promise<Response> => {
    const currentUser = await userService.findOne({ id: res.locals.user.id });
    const afipData = await getAfipData(currentUser.cuit);
    const updated = await userService.updateAfipData(currentUser.id, afipData);

    return res.status(200).json({
        success: true,
        message: "Usuario actualizado correctamente",
        data: updated
    });
};

const login = async (req: Request, res: Response): Promise<Response> => {
    const body = loginUserValidator.parse(req.body);
    const user = await userService.findByUsername(body.username);
    const hash = await userService.getPasswordHash(user.id);
    const match = await bcrypt.compare(body.password, hash);

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
    if (!isValid) {
        await removeCert(certPath);
        throw new ValidationError("El certificado no es valido");
    }

    return res.status(201).json({
        success: true,
        message: "Certificado subido correctamente"
    })
}

const getOne = async (req: Request, res: Response): Promise<Response> => {
    const user = await userService.findOne({ id: res.locals.user.id });

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
