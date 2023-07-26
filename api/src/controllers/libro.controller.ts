import {Request, Response} from "express";

import { Persona } from "../models/persona.model.js";
import { Libro } from "../models/libro.model.js";
import { validateLibro, createLibro, retrieveLibro  } from "../schemas/libros.schema";
import { 
    TipoPersona, 
    createPersonaLibroInDB, 
    createPersonaLibroNOTInDB, 
    removePersonaLibro,
    updateLibroPersona, 
    validateLibroPersona
} from "../schemas/libro_persona.schema";

import { Duplicated, NotFound, ValidationError } from "../models/errors.js"
import { validatePersona } from "../schemas/persona.schema.js";
import { LibroPersona } from "../models/libro_persona.model.js";


function parse_create_req(body: createLibro){
    let tipos_keys: ("autores" | "ilustradores")[] = ["autores", "ilustradores"];

    let personas = [];
    for (let tipo of tipos_keys) {
        if (tipo in body){
            for (let _persona of body[tipo]) {
                _persona.tipo = tipo === "autores" ? TipoPersona.autor : TipoPersona.ilustrador;
                personas.push(_persona);
                
            }
        }
    }

    return personas;
}
function remove_duplicateds(list: any[]) {
    const uniqueIds: number[] = [];
    return list.filter(element => {
        const isDuplicate = uniqueIds.includes(element.id);
  
        if (!isDuplicate) {
          uniqueIds.push(element.id);
          return true;
        }
  
        return false;
      });
}

const create = async (req: Request, res: Response) => { 
    let personas = parse_create_req(req.body);
    console.log(personas);
    
    let indb: createPersonaLibroInDB[] = [];
    let not_indb: createPersonaLibroNOTInDB[] = [];

    let valid_c = validateLibro.create(req.body);
    if (valid_c.error !== null) return res.status(400).json({
        success: false,
        error: valid_c.error
    });
    const body = valid_c.obj;

    for (let _persona of personas){
        if ("id" in _persona){
            indb.push(_persona);
        }else{
            not_indb.push(_persona);
        }
    }

    indb = remove_duplicateds(indb);       
    await Libro.is_duplicated(body.isbn);

    if (!await Persona.all_exists(indb.map(p => ({id: p.id}))))
        throw new ValidationError("Alguna persona no existe");

    if(await Persona.any_exists(not_indb.map(p => ({dni: p.dni}))))
        throw new ValidationError("Alguna persona ya se encuentra cargada");

    for (let _persona of not_indb){
        let valid = validatePersona.create(Object.assign({}, _persona));
        if (valid.error !== null) 
            throw new ValidationError(valid.error);

        const persona = await Persona.insert(valid.obj);

        indb.push({
            porcentaje: _persona.porcentaje, 
            tipo: _persona.tipo, 
            id: persona.id,
            isbn: body.isbn
        });
    }

    let valid = validateLibro.save(body);
    if (valid.error !== null) 
        throw new ValidationError(valid.error);

    const libro = await Libro.insert(valid.obj);
    await libro.add_personas(indb);

    return res.status(201).json({
        success: true,
        message: `Libro con isbn ${body.isbn} creado correctamente`,
        data: {
            ...libro,
            autores:      indb.filter(p => p.tipo == TipoPersona.autor),
            ilustradores: indb.filter(p => p.tipo == TipoPersona.ilustrador),
        }
    });
}

const remove = async(req: Request, res: Response) => {
    await Libro.delete(req.params.isbn);

    return res.json({
        success: true,
        message: `Libro con isbn ${req.params.isbn} eliminado correctamente`
    })
}

const update = async(req: Request, res: Response) => {
    let valid = validateLibro.update(req.body)
    if (valid.error !== null) return res.status(404).json({
        success: false,
        error: valid.error
    });
    const body = valid.obj;

    const libro = await Libro.get_by_isbn(req.params.isbn);
    await libro.update(body);

    return res.status(201).json({
        success: true,
        message: `Libro con isbn ${req.params.isbn} actualizado correctamente`,
        data: libro
    })
}

const manage_personas = async(req: Request, res: Response) => {
    let body = Array.isArray(req.body) ? req.body : [req.body]; //Hacemos que personas sea un array si o si

    let code = 201;
    let message = 'creadas';

    let personas: any[] = [];
        
    let libro = await Libro.get_by_isbn(req.params.isbn);

    if (!await Persona.all_exists(body.map(p => ({id: p.id}))))
        throw new NotFound("Alguna persona no existe");

    body = body.map(p => ({...p, isbn: libro.isbn}));

    switch (req.method) {
        case "POST":
            let personas_i = validateLibroPersona.all<createPersonaLibroInDB>(body, validateLibroPersona.indb);
            personas = personas_i;

            if (await LibroPersona.any_exists(personas_i.map(p => ({tipo: p.tipo, isbn: p.isbn, id_persona: p.id}))))
                throw new Duplicated("Alguna persona ya trabaja en ese libro");
                
            await libro.add_personas(personas_i);

            break;
        case "PUT":
            let personas_u = validateLibroPersona.all<updateLibroPersona>(body, validateLibroPersona.update);
            personas = personas_u;

            if (!await LibroPersona.all_exists(personas_u.map(p => ({tipo: p.tipo, isbn: p.isbn, id_persona: p.id}))))
                throw new NotFound("Alguna persona no trabaja en este libro");

            await libro.update_personas(personas_u);
            message = 'actualizadas'

            break;
        case "DELETE":
            let personas_d = validateLibroPersona.all<removePersonaLibro>(body, validateLibroPersona.remove);
            personas = personas_d;

            if (!await LibroPersona.any_exists(personas_d.map(p => ({tipo: p.tipo, isbn: p.isbn, id_persona: p.id}))))
                throw new Duplicated("Alguna persona ya trabaja en ese libro");

            await libro.remove_personas(personas_d);
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
}

const get_ventas = async(req: Request, res: Response) => {
    const ventas = await Libro.get_ventas(req.params.isbn);
    return res.json(ventas);
}

const get_one = async(req: Request, res: Response) => {
    let libro = await Libro.get_by_isbn(req.params.isbn)
    const {autores, ilustradores} = await libro.get_personas();
    return res.json({
        ...libro,
        autores: autores,
        ilustradores: ilustradores
    });
}

const get_all = async(req: Request, res: Response) => {
    let libros: retrieveLibro[] = [];
    if ("page" in req.query){
        libros = await Libro.get_paginated(Number(req.query.page) || 0);
    }else{
        libros = await Libro.get_all();
    }
    return res.json(libros);
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
