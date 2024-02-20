import { NextFunction, Request, Response } from "express"
import { Persona } from "../models/persona.model";
import { ValidationError, Duplicated } from '../models/errors';
import { createPersona, updatePersona} from "../schemas/persona.schema";
import { libroPersonaSchema} from "../schemas/libro_persona.schema";

const create = async (req: Request, res: Response): Promise<Response> => {
    const body = createPersona.parse(req.body);
    
    if (await Persona.exists(body.dni)){
        throw new Duplicated(`La persona con dni ${body.dni} ya se encuentra cargada`);
    }

    const persona = await Persona.insert(body);

    return res.status(201).json({
        success: true,
        message: "Persona creada correctamente",
        data: persona
    });
}

const update = async (req: Request, res: Response): Promise<Response> => {
    const id = Number(req.params.id);
    if (!id) throw new ValidationError("El id de la persona debe ser un integer");

    const body = updatePersona.parse(req.body);

    const persona = await Persona.getById(id);

    if (body.dni && body.dni != persona.dni && await Persona.exists(body.dni)){
        throw new Duplicated(`La persona con id ${body.dni} ya se encuentra cargada`);
    }

    await persona.update(body);

    return res.status(201).json({
        success: true,
        message: "Persona actualizada correctamente",
        data: persona
    });
}

const remove = async (req: Request, res: Response): Promise<Response> => {    
    const id = Number(req.params.id);
    if (!id) throw new ValidationError("El id de la persona debe ser un integer");

    await Persona.delete({id: id})

    return res.json({
        success: true,
        message: `Persona con id ${id} eliminada correctamente`
    });
}

const getAll = async (req: Request, res: Response): Promise<Response>  => {
    let personas: any[];

    if ('tipo' in req.query){
        const tipo = libroPersonaSchema.shape.tipo.parse(req.query.tipo);
        personas = await Persona.getAllByTipo(tipo);
    }else {
        personas = await Persona.getAll()
    }

    return res.json(personas);
}

const getOne = async (req: Request, res: Response): Promise<Response> => {
    const id = Number(req.params.id);
    if (!id) throw new ValidationError("El id de la persona debe ser un integer");
    
    const persona = await Persona.getById(id);
    const libros = await persona.getLibros();

    return res.json({
        ...persona,
        libros: libros
    });
}

export default {
    create,
    update,
    remove,
    getAll,
    getOne
}
