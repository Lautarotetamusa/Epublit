import { Request, Response } from "express";
import { ValidationError } from '../models/errors';

import { createLiquidacion } from "../schemas/liquidacion.schema";

import { Liquidacion } from "../models/liquidacion.model";
import { Libro } from "../models/libro.model";
import { Persona } from "../models/persona.model";
import { LibroPersona } from "../models/libro_persona.model";

const create = async (req: Request, res: Response): Promise<Response> => {
    const body = createLiquidacion.parse(req.body); 

    if (!(await Liquidacion.valid_period(body.fecha_inicial, body.fecha_final))){
        throw new ValidationError("Ya existe una liquidacion en el periodo seleccionado");
    }
    const persona = await Persona.getById(body.id_persona, res.locals.user.id);

    if (!await LibroPersona.exists({
        id_persona: body.id_persona,
        tipo: body.tipo_persona,
        isbn: body.isbn
    })){
        throw new ValidationError(`La persona con id ${body.id_persona} no trabaja en el libro ${body.isbn}`);
    }

    const ventas = await Liquidacion.getVentas(body);
    const total: number = ventas.reduce((total, row) => total + row.cantidad * row.precio_venta, 0);
    const file_path = "TEST";

    const liquidacion = await Liquidacion.insert({
        ...body,
        total: total, 
        file_path: file_path,
    });

    return res.status(201).json({
        success: true,
        message: "Liquidacion creada con exito",
        data: {
            ...liquidacion,
            persona: persona
        }
    });
}

const getOne = async (req: Request, res: Response): Promise<Response> => {
    if (!('id' in req.params)) throw new ValidationError("Se debe pasar un id para obtener la liquidacion")
    const id = Number(req.params.id);

    const liquidacion = await Liquidacion.getOne(id);
    const libro = await Libro.getByIsbn(liquidacion.isbn, res.locals.user.id);
    const ventas = await liquidacion.get_details();

    return res.status(200).json({
        ...liquidacion,
        libro: libro,
        ventas: ventas
    });
}

const getAll = async (req: Request, res: Response): Promise<Response> => {
    const liquidaciones = await Liquidacion.getAll();
    return res.status(200).json(liquidaciones);

}
export default {
    create,
    getOne,
    getAll
}
