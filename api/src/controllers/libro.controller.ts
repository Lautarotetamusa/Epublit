import {Request, Response} from "express";

import { Persona } from "../models/persona.model.js";
import { Libro } from "../models/libro.model.js";
import { validateLibro  } from "../schemas/libros.schema";
import { TipoPersona, createPersonaLibroInDB, createPersonaLibroNOTInDB, validateLibroPersona} from "../schemas/libro_persona.schema";
import { parse_error, ValidationError } from "../models/errors.js"
import { createPersona, validatePersona } from "../schemas/persona.schema.js";


function parse_create_req(req: Request){
    let tipos_keys: ("autores" | "ilustradores")[] = ["autores", "ilustradores"];

    let personas = [];
    for (let tipo of tipos_keys) {
        if (tipo in req.body){
            for (let _persona of req.body[tipo]) {
                _persona.tipo = tipo === "autores" ? TipoPersona.autor : TipoPersona.ilustrador;
                personas.push(_persona);
            }
        }
    }
    return personas;
}

const create = async (req: Request, res: Response) => {   
    let personas = parse_create_req(req);
    let new_personas: createPersonaLibroNOTInDB[] = []; 
    let personas_data: Array<createPersonaLibroInDB> = []; //Lista de personas validas y cargadas

    let valid = validateLibro.create(req.body);
    if (valid.error !== null) return res.status(400).json({
        success: false,
        error: valid.error
    })
    const body = valid.obj;
    
    try {          
        await Libro.is_duplicated(body.isbn);

        for (let _persona of personas) { //Para cada persona
            if ("id" in _persona){ //Personas ya cargadas en la DB
                await Persona.get_by_id(_persona.id); //Revisar que la persona exista
            
                personas_data.push(_persona);
            }else{ //Personas que todavia no estan cargadas en la DB
                if (await Persona.exists(_persona.dni)) //Revisar que la persona con ese dni no exista todavia
                    throw new ValidationError(`La persona con dni ${_persona.dni} ya se encuentra cargada`);

                new_personas.push(_persona);
            }
        }

        for (let _persona of new_personas){
            let valid = validatePersona.create(Object.assign({}, _persona));
            if (valid.error !== null) throw new ValidationError(valid.error);

            const persona = await Persona.insert(valid.obj);

            personas_data.push({
                porcentaje: _persona.porcentaje, 
                tipo: _persona.tipo, 
                id: persona.id,
                isbn: body.isbn
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

        let valid = validateLibro.save(body);
        if (valid.error !== null) throw new ValidationError(valid.error);

        const libro = await Libro.insert(valid.obj);
        await libro.add_personas(personas_data);

        return res.status(201).json({
            success: true,
            message: `Libro con isbn ${body.isbn} creado correctamente`,
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
        await Libro.delete(req.params.isbn);

        return res.json({
            success: true,
            message: `Libro con isbn ${req.params.isbn} eliminado correctamente`
        })
    } catch (error: any) {
        return parse_error(res, error); 
    }
}

const update = async(req: Request, res: Response) => {
    let valid = validateLibro.update(req.body)
    if (valid.error !== null) return res.status(404).json({
        success: false,
        error: valid.error
    });
    const body = valid.obj;

    try {
        let libro = await Libro.get_by_isbn(req.params.isbn);
        await libro.update(body);

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
    let body = Array.isArray(req.body) ? req.body : [req.body]; //Hacemos que personas sea un array si o si

    let code = 201
    let message = 'creadas'
    
    try {
        let libro = await Libro.get_by_isbn(req.params.isbn);

        for (let persona of body) {
            await Persona.get_by_id(persona.id); //Check if the person exists
        }

        let personas = [];
        switch (req.method) {
            case "POST":
                personas = [];
                for (let persona of body){
                    persona.isbn = libro.isbn;
                    let valid = validateLibroPersona.indb(persona);
                    if (valid.error !== null) 
                        throw new ValidationError(valid.error)
                    personas.push(valid.obj);
                }

                await libro.add_personas(personas);

                break;
            case "PUT":
                personas = [];
                for (let persona of body){
                    persona.isbn = libro.isbn;
                    let valid = validateLibroPersona.update(persona);
                    if (valid.error !== null) 
                        throw new ValidationError(valid.error)
                    personas.push(valid.obj);
                }

                await libro.update_personas(personas);
                message = 'actualizadas'

                break;
            case "DELETE":
                personas = [];
                for (let persona of body){
                    persona.isbn = libro.isbn;
                    let valid = validateLibroPersona.remove(persona);
                    if (valid.error !== null) 
                        throw new ValidationError(valid.error)
                    personas.push(valid.obj);
                }

                await libro.remove_personas(personas);
                message = 'borradas'
                code = 200
                
                break;
        }

        return res.status(code).json({
            success: true,
            message: `Personas ${message} con exito`,
            data: {
                ...libro,
                personas: personas,

            }
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
        const {autores, ilustradores} = await libro.get_personas();
        return res.json({
            ...libro,
            autores: autores,
            ilustradores: ilustradores
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
