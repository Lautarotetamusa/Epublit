import {Request, Response} from "express";

import { IPersona, Persona } from "../models/persona.model.js";
import { Libro } from "../models/libro.model.js";
import { TipoPersona} from "../schemas/persona.schema";
import { validateLibroPersona, createPersonaLibroInDB, createPersonaLibroNOTInDB, validateLibro  } from "../schemas/libros.schema";
import { parse_error, ValidationError } from "../models/errors.js"

const create = async (req: Request, res: Response) => {
    try {
        if (!validateLibro.create(req.body)){
            throw new ValidationError(validateLibro.error)
        }
    
        let body = req.body;

        let personas_data: Array<createPersonaLibroInDB> = [];  //Lista de personas validas y cargadas

        await Libro.is_duplicated(req.body.isbn);

        let tipos_keys: ("autores" | "ilustradores")[] = ["autores", "ilustradores"];

        let new_personas: createPersonaLibroNOTInDB[] = [];
        for (let tipo of tipos_keys) { //Para cada tipo (autores, ilustradores)
            for (let _persona of body[tipo]) { //Para cada persona
                _persona.tipo = tipo === "autores" ? TipoPersona.autor : TipoPersona.ilustrador;

                if ("id" in _persona){ //Personas ya cargadas en la DB
                    if (!validateLibroPersona.indb(_persona))
                        throw new ValidationError(validateLibroPersona.error)
                    
                    await Persona.get_by_id(_persona.id)
                    personas_data.push(_persona);

                }else{ //Personas que todavia no estan cargadas en la DB
                    if (!validateLibroPersona.not_in_db(_persona))
                        throw new ValidationError(validateLibroPersona.error)

                    if (await Persona.exists(_persona.dni))
                        throw new ValidationError(`La persona con dni ${_persona.dni} ya se encuentra cargada`);

                    new_personas.push(_persona);
                }
            }
        };

        for (let _persona of new_personas){
            const persona = await Persona.insert(_persona);

            personas_data.push({
                porcentaje: _persona.porcentaje, 
                tipo: _persona.tipo, 
                id: persona.id
            });
        }

        //remover duplicados
        const uniqueIds: number[] = [];
        personas_data = personas_data.filter(element => {
          const isDuplicate = uniqueIds.includes(element.id);

          if (!isDuplicate) {
            uniqueIds.push(element.id);
            return true;
          }

          return false;
        });

        console.log("personas_data:", personas_data);

        const libro = await Libro.insert(body);
        await libro.add_personas(personas_data);

        return res.status(201).json({
            success: true,
            message: `Libro con isbn ${req.body.isbn} creado correctamente`,
            data: {
                ...libro,
                autores:      personas_data.filter(p => p.tipo == TipoPersona.autor),
                ilustradores: personas_data.filter(p => p.tipo == TipoPersona.ilustrador),
            }
        })

    } catch (error: any) {
        return parse_error(res, error);
    }
}

const remove = async(req: Request, res: Response) => {
    try {
        await Libro.delete(req.params.isbn)

        return res.json({
            success: true,
            message: `Libro con isbn ${req.params.isbn} eliminado correctamente`
        })
    } catch (error: any) {
        return parse_error(res, error); 
    }
}

const update = async(req: Request, res: Response) => {
    if(!validateLibro.update(req.body)) return res.status(404).json({
        success: false,
        error: validateLibro.error
    });

    try {
        let libro = await Libro.get_by_isbn(req.params.isbn);
        await libro.update(req.body);

        return res.status(201).json({
            success: true,
            message: `Libro con isbn ${req.params.isbn} actualizado correctamente`,
            data: libro
        })
    } catch (error: any) {
        return parse_error(res, error);
    }
}

const manage_personas = async(req: Request, res: Response) => {
    let personas = Array.isArray(req.body) ? req.body : [req.body]; //Hacemos que personas sea un array si o si

    let code = 201
    let message = 'creada'
    
    try {
        let libro = await Libro.get_by_isbn(req.params.isbn);

        for (let persona of personas) {
            Libro.validate_persona(persona);
            await Persona.get_by_id(persona.id); //Check if the person exists
        }

        switch (req.method ) {
            case "POST":
                await libro.add_personas(personas);
                break;
            case "PUT":
                await libro.update_personas(personas);
                message = 'actualizada'
                break;
            case "DELETE":
                await libro.remove_personas(personas);
                message = 'borrada'
                code = 200
                break;
        }

        return res.status(code).json({
            success: true,
            message: `Personas ${message} con exito`
        });

    } catch (error: any) {
        return parse_error(res, error);
    }
}

const get_ventas = async(req: Request, res: Response) => {
    try {
        let ventas = await Libro.get_ventas(req.params.isbn);
        return res.json(ventas);
    } catch (error: any) {
        return parse_error(res, error);
    }
}

const get_one = async(req: Request, res: Response) => {
    try {
        let libro = await Libro.get_by_isbn(req.params.isbn)
        const personas = await libro.get_personas();
        return res.json({
            ...libro,
            ...personas
        });
    } catch (error: any) {
        return parse_error(res, error);
    }
}

const get_all = async(req: Request, res: Response) => {
    try {
        let libros = [];
        if ("page" in req.query){
            libros = await Libro.get_paginated(Number(req.query.page) || 0);
        }else{
            libros = await Libro.get_all();
        }
        res.json(libros);
    } catch (error: any) {
        return parse_error(res, error);
    }
}

export default{
    get_all,
    get_one,
    get_ventas,
    manage_personas,
    create,
    remove,
    update
}
