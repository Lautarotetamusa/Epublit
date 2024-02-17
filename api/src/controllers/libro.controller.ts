import {Request, Response} from "express";
import { Persona } from "../models/persona.model.js";
import { Libro } from "../models/libro.model.js";
import { 
    CreateLibroPersona,
    LibroPersonaSchema,
    libroPersonaSchema,
    tipoPersona, 
} from "../schemas/libro_persona.schema";
import { Duplicated, NotFound, ValidationError } from "../models/errors.js"
import { LibroPersona } from "../models/libro_persona.model.js";

import fs from 'fs';
import {  createLibro, updateLibro } from "../schemas/libros.schema.js";

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
    const {personas, ...libroBody} = createLibro.parse(req.body);
    let indb: LibroPersonaSchema[] = [];
    let not_indb: CreateLibroPersona[] = [];

    for (const persona of personas){
        if ("id_persona" in persona){
            indb.push(persona);
        }else{
            not_indb.push(persona);
        }
    }

    indb = remove_duplicateds(indb);       
    await Libro.is_duplicated(libroBody.isbn);

    if (!await Persona.all_exists(indb.map(p => ({id: p.id_persona})))){
        throw new ValidationError("Alguna persona no existe");
    }

    if(await Persona.any_exists(not_indb.map(p => ({dni: p.dni})))){
        throw new ValidationError("Alguna persona ya se encuentra cargada");
    }

    for (const personaBody of not_indb){
        const persona = await Persona.insert(personaBody);

        indb.push({
            porcentaje: personaBody.porcentaje, 
            tipo: personaBody.tipo, 
            id_persona: persona.id,
            isbn: libroBody.isbn
        });
    }
    const libro = await Libro.insert(libroBody);
    await libro.add_personas(indb);

    return res.status(201).json({
        success: true,
        message: `Libro con isbn ${libroBody.isbn} creado correctamente`,
        data: {
            ...libro,
            autores:      indb.filter(p => tipoPersona[p.tipo] == tipoPersona.autor),
            ilustradores: indb.filter(p => tipoPersona[p.tipo] == tipoPersona.ilustrador),
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
    const body = updateLibro.parse(req.body);

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
        
    const libro = await Libro.get_by_isbn(req.params.isbn);

    if (!await Persona.all_exists(body.map(p => ({id: p.id})))){
        throw new NotFound("Alguna persona no existe");
    }

    body = body.map(p => ({...p, isbn: libro.isbn}));
    const personas = libroPersonaSchema.array().parse(req.body);

    switch (req.method) {
        case "POST":
            if (await LibroPersona.any_exists(personas)){
                throw new Duplicated("Alguna persona ya trabaja en ese libro");
            }
                
            await libro.add_personas(personas);
            break;
        case "PUT":
            if (!await LibroPersona.all_exists(personas)){
                throw new NotFound("Alguna persona no trabaja en este libro");
            }

            await libro.update_personas(personas);
            message = 'actualizadas'

            break;
        case "DELETE":

            if (!await LibroPersona.any_exists(personas)){
                throw new Duplicated("Alguna persona ya trabaja en ese libro");
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
}

const get_ventas = async(req: Request, res: Response) => {
    const ventas = await Libro.get_ventas(req.params.isbn);
    return res.json(ventas);
}

const get_one = async(req: Request, res: Response) => {
    const libro = await Libro.get_by_isbn(req.params.isbn)
    const {autores, ilustradores} = await libro.get_personas();
    return res.json({
        ...libro,
        autores: autores,
        ilustradores: ilustradores
    });
}

const lista_libros = async (req: Request, res: Response) => {
    const libros = await Libro.get_all();

    let len = Object.keys(libros[0]).length;
    let header = 'LISTA DE LIBROS' + ','.repeat(len) + '\r\n';
    let headers = Object.keys(libros[0]).join(',') + '\r\n';
    let data = libros.map(l => Object.values(l).join(',')).join('\r\n');

    let file_path = 'lista_libros.csv';
    fs.writeFileSync(file_path, header+headers+data);
    return res.download(file_path);
}

const get_all = async(req: Request, res: Response) => {
    if ("page" in req.query){
        const libros = await Libro.get_paginated(Number(req.query.page) || 0);
        return res.json(libros);
    }

    const libros = await Libro.get_all();
    return res.json(libros);
}

export default{
    get_all,
    get_one,
    get_ventas,
    manage_personas,
    create,
    remove,
    update,
    lista_libros
}
