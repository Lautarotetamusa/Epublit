import {Request, Response} from "express";
import { ValidationError } from "../models/errors"
import { Transaccion } from "../models/transaccion.model";

const getOne = (transaccion: typeof Transaccion) => {
    return async (req: Request, res: Response): Promise<Response> => {
        const id = Number(req.params.id);
        if (!id) throw new ValidationError("El id debe ser un numero");

        const t = await transaccion.getById(id);
        console.log(t);
        const libros = await t.getLibros();
        return res.json({
            ...t,
            libros: libros
        });
    }
}

const getAll = (transaccion: typeof Transaccion) => {
    return async (_: Request, res: Response): Promise<Response> => {
        const t = await transaccion.getAll(res.locals.user.id);
        return res.json(t);
    }
}   

export default{
    getOne,
    getAll,
}
