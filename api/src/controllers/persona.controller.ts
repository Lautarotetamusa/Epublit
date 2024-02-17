import { NextFunction, Request, Response } from "express"
import { Persona } from "../models/persona.model";
import { ValidationError, Duplicated } from '../models/errors';
import { createPersona, updatePersona} from "../schemas/persona.schema";
import { libroPersonaSchema} from "../schemas/libro_persona.schema";

const create = async (req: Request, res: Response, next: NextFunction): Promise<Response> => {
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

    const persona = await Persona.get_by_id(id);

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

const get_all = async (req: Request, res: Response): Promise<Response>  => {
    let params = req.query;
    let personas: any[];

    if ('tipo' in params){
        const tipo = libroPersonaSchema.shape.tipo.parse(req.query.tipo);
        personas = await Persona.get_all_by_tipo(tipo);
    }else {
        personas = await Persona.get_all()
    }

    return res.json(personas);
}

const get_one = async (req: Request, res: Response): Promise<Response> => {
    const id = Number(req.params.id);
    if (!id) throw new ValidationError("El id de la persona debe ser un integer");
    
    const persona = await Persona.get_by_id(id);
    const libros = await persona.get_libros();

    return res.json({
        ...persona,
        libros: libros
    });
}

export default {
    create,
    update,
    remove,
    get_all,
    get_one
}
