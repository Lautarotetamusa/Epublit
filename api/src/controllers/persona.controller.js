import { Persona } from "../models/persona.model.js";
import { parse_error } from '../models/errors.js'

export const PersonaController = {};


PersonaController.create = async (req, res) => {
     try {
        Persona.validate(req.body);

        const persona = new Persona(req.body);

        await persona.insert(req.body);

        return res.status(201).json({
            success: true,
            message: "Persona creada correctamente",
            data: persona
        });

    } catch (error) {
        return parse_error(res, error);
    }
}

PersonaController.update = async (req, res) => {
    try {
        const persona = new Persona(await Persona.get_by_id(req.params.id));
    
        if (Object.keys(persona).length === 0 && persona.constructor === Object) //Si persona es un objeto vacio
            return res.status(204).json({
                success:true,
                message: "No hay ningun campo para actualizar",
            })

        await persona.update(req.body);

        return res.status(201).json({
            success:true,
            message: "Persona actualizada correctamente",
            data: persona
        })

    } catch (error) {
        return parse_error(res, error);
    }
}

PersonaController.delete = async (req, res) => {
    try {
        await Persona.delete(req.params.id)

        return res.json({
            success: true,
            message: `Persona con id ${req.params.id} eliminada correctamente`
        })

    } catch (error) {
        return parse_error(res, error);
    }
}

PersonaController.get_all = async (req, res) => {
    let params = req.query;
    let personas;

    try {

        if ('tipo' in params){
            if(!(params.tipo in Persona.tipos)) return res.status(400).json({
                success: false,
                message: `El tipo pasado no es correcto (${Persona.str_tipos})`
            })

            personas = await Persona.get_all_by_tipo(Persona.tipos[params.tipo])
        }else {
            personas = await Persona.get_all()
        }

        return res.json(personas);

    } catch (error) {
        return parse_error(res, error);
    }
}

PersonaController.get_one = async (req, res) => {
    let params = req.params;

    if (!params.id) return res.status(400).json({
        success: false,
        message: "Se nececita pasar un id"
    });

    try {
        const persona  = await Persona.get_by_id(params.id);
        
        persona.libros = await Persona.get_libros(params.id)

        res.json(persona);
    } catch (error) {
        return parse_error(res, error);
    }
}
