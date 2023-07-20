import { Request, Response } from "express"
import { Persona } from "../models/persona.model";
import { ValidationError, Duplicated, parse_error } from '../models/errors';
import { validatePersona } from "../schemas/persona.schema";
import { TipoPersona, TipoPersonaString } from "../schemas/libro_persona.schema";

const create = async (req: Request, res: Response): Promise<Response> => {
    let valid = validatePersona.create(req.body);
    if (valid.error !== null) return res.status(400).json({
        success: false,
        error: valid.error
    })
    const body = valid.obj;
    
    try{
        if (await Persona.exists(body.dni)){
            throw new Duplicated(`La persona con dni ${body.dni} ya se encuentra cargada`);
        }

        const persona = await Persona.insert(body);

        return res.status(201).json({
            success: true,
            message: "Persona creada correctamente",
            data: persona
        });
    }catch(error: any){
        return parse_error(res, error)
    }
}

const update = async (req: Request, res: Response): Promise<Response> => {
    let valid = validatePersona.update(req.body);
    if (valid.error !== null) return res.status(400).json({
        success: false,
        error: valid.error
    })
    const body = valid.obj;
    const id = Number(req.params.id);

    try {
        if (!id)
            throw new ValidationError("El id de la persona debe ser un integer");

        const persona = await Persona.get_by_id(id);

        if (body.dni && body.dni != persona.dni && await Persona.exists(body.dni))
            throw new Duplicated(`La persona con id ${body.dni} ya se encuentra cargada`);

        await persona.update(body);
        console.log(persona);
    
        return res.status(201).json({
            success: true,
            message: "Persona actualizada correctamente",
            data: persona
        });
    } catch (error: any) {
        return parse_error(res, error);
    }
}

const remove = async (req: Request, res: Response): Promise<Response> => {
    const id = Number(req.params.id);
    
    try {
        if (!id)
            throw new ValidationError("El id de la persona debe ser un integer");

        await Persona.delete({id: id})

        return res.json({
            success: true,
            message: `Persona con id ${id} eliminada correctamente`
        });

    } catch (error: any) {
        return parse_error(res, error);
    }
}

const get_all = async (req: Request, res: Response): Promise<Response>  => {
    let params = req.query;
    let personas: any[];

    try {
        if ('tipo' in params){
            let tipo: TipoPersonaString = <TipoPersonaString>String(req.query.tipo);

            if( !(Object.values(TipoPersona).includes(tipo)) )
                return res.status(400).json({
                    success: false,
                    message: `El tipo pasado no es correcto (${TipoPersona})`
                })

            personas = await Persona.get_all_by_tipo(TipoPersona[tipo])
        }else {
            personas = await Persona.get_all()
        }

        return res.json(personas);

    } catch (error: any) {
        return parse_error(res, error);
    }
}

const get_one = async (req: Request, res: Response)  => {
    const id = Number(req.params.id);
    
    try {
        if (!id)
            throw new ValidationError("El id de la persona debe ser un integer");

        const persona = await Persona.get_by_id(id);

        await persona.get_libros();

        res.json(persona);
    } catch (error: any) {
        return parse_error(res, error);
    }
}

export default {
    create,
    update,
    remove,
    get_all,
    get_one
}