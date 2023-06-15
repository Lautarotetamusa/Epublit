import {Request, Response} from "express"
import { Persona, TipoPersona, IPersona, TipoPersonaString } from "../models/persona.model";
import { parse_error } from '../models/errors'

interface ApiResponse{
    data?: Object;
}
interface ApiResponseSuccess extends ApiResponse{
    success: true;
    message: string;
    error?: never;
}
interface ApiResponseError extends ApiResponse{
    success: false;
    message?: never;
    error: string;
}

const create = async (req: Request, res: Response): Promise<Response> => {
     try {
        let body: IPersona = req.body;

        Persona.validate(body);

        const persona = new Persona(body);

        await persona.insert();

        let response: ApiResponseSuccess = {
            success: true,
            message: "Persona creada correctamente",
            data: persona
        }

        return res.status(201).json(response);

    } catch (error: any) {
        return parse_error(res, error);
    }
}

const update = async (req: Request, res: Response): Promise<Response> => {
    const body: IPersona = req.body;
    const id = Number(req.params.id);

    try {
        const persona = new Persona(await Persona.get_by_id(id));
        
        if (Object.keys(persona).length === 0 && persona.constructor === Object) //Si persona es un objeto vacio
            return res.status(204).json({
                success:true,
                message: "No hay ningun campo para actualizar",
            })

        await persona.update(req.body);

        let response: ApiResponseSuccess = {
            success: true,
            message: "Persona creada correctamente",
            data: persona
        }

        return res.status(201).json(response);

    } catch (error: any) {
        return parse_error(res, error);
    }
}

const remove = async (req: Request, res: Response): Promise<Response>  => {
    try {
        await Persona.delete(Number(req.params.id))

        let response: ApiResponseSuccess = {
            success: true,
            message: `Persona con id ${req.params.id} eliminada correctamente`
        }

        return res.json(response);

    } catch (error: any) {
        return parse_error(res, error);
    }
}

const get_all = async (req: Request, res: Response): Promise<Response>  => {
    let params = req.query;
    let personas: IPersona[];

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
    let params = req.params;

    if (!params.id) return res.status(400).json({
        success: false,
        message: "Se nececita pasar un id"
    });

    try {
        const persona  = await Persona.get_by_id(Number(params.id));
        
        persona.libros = await Persona.get_libros(Number(params.id))

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
