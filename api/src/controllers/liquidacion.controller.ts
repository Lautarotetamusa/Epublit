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
    const persona = await Persona.get_by_id(body.id_persona);

    if (!await LibroPersona.exists({
        id_persona: body.id_persona,
        tipo: body.tipo_persona,
        isbn: body.isbn
    })){
        throw new ValidationError(`La persona con id ${body.id_persona} no trabaja en el libro ${body.isbn}`);
    }

    const ventas = await Liquidacion.get_ventas(body);
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

const get_one = async (req: Request, res: Response): Promise<Response> => {
    if (!('id' in req.params)) throw new ValidationError("Se debe pasar un id para obtener la liquidacion")
    const id = Number(req.params.id);

    const liquidacion = await Liquidacion.get_one(id);
    const libro = await Libro.get_by_isbn(liquidacion.isbn);
    const ventas = await liquidacion.get_details();

    return res.status(200).json({
        ...liquidacion,
        libro: libro,
        ventas: ventas
    });
}

const get_all = async (req: Request, res: Response): Promise<Response> => {
    const liquidaciones = await Liquidacion.get_all();
    return res.status(200).json(liquidaciones);

}
export default {
    create,
    get_one,
    get_all
}
