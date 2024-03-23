import {Request, Response} from "express";
import { Persona } from "../models/persona.model";
import { Libro } from "../models/libro.model";
import { 
    CreateLibroPersona,
    LibroPersonaSchema,
    libroPersonaSchema,
    tipoPersona, 
} from "../schemas/libro_persona.schema";
import { Duplicated, NotFound, ValidationError } from "../models/errors"
import { LibroPersona } from "../models/libro_persona.model";

import fs from 'fs';
import {  createLibro, updateLibro } from "../schemas/libros.schema";

function removeDuplicateds(list: any[]) {
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
    let notIndb: CreateLibroPersona[] = [];

    for (const persona of personas){
        if ("id_persona" in persona){
            indb.push({
                ...persona,
                isbn: libroBody.isbn
            });
        }else{
            notIndb.push(persona);
        }
    }

    indb = removeDuplicateds(indb);       
    await Libro.is_duplicated(libroBody.isbn);

    if (!await Persona.all_exists(indb.map(p => ({id: p.id_persona})))){
        throw new ValidationError("Alguna persona no existe");
    }

    if(await Persona.any_exists(notIndb.map(p => ({dni: p.dni})))){
        throw new ValidationError("Alguna persona ya se encuentra cargada");
    }

    for (const personaBody of notIndb){
        const persona = await Persona.insert({
            nombre: personaBody.nombre,
            email: personaBody.email,
            dni: personaBody.dni,
            user: res.locals.user.id
        });

        indb.push({
            porcentaje: personaBody.porcentaje, 
            tipo: personaBody.tipo, 
            id_persona: persona.id,
            isbn: libroBody.isbn
        });
    }
    const libro = await Libro.insert({
        ...libroBody,
        user: res.locals.user.id
    });

    await LibroPersona.insert(indb);

    return res.status(201).json({
        success: true,
        message: `Libro con isbn ${libroBody.isbn} creado correctamente`,
        data: {
            ...libro,
            autores:      indb.filter(p => p.tipo == tipoPersona.autor),
            ilustradores: indb.filter(p => p.tipo == tipoPersona.ilustrador),
        }
    });
}

const remove = async(req: Request, res: Response) => {
    await Libro.delete(req.params.isbn, res.locals.user.id);

    return res.json({
        success: true,
        message: `Libro con isbn ${req.params.isbn} eliminado correctamente`
    })
}

const update = async(req: Request, res: Response) => {
    const body = updateLibro.parse(req.body);
    const user = res.locals.user.id;

    const libro = await Libro.getByIsbn(req.params.isbn, user);
    await libro.update(body, user);

    return res.status(201).json({
        success: true,
        message: `Libro con isbn ${req.params.isbn} actualizado correctamente`,
        data: libro
    })
}

const managePersonas = async(req: Request, res: Response) => {
    let body = Array.isArray(req.body) ? req.body : [req.body]; //Hacemos que personas sea un array si o si
    let code = 201;
    let message = 'creadas';
        
    const libro = await Libro.getByIsbn(req.params.isbn, res.locals.user.id);

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
                
            await LibroPersona.insert(personas);
            break;
        case "PUT":
            if (!await LibroPersona.all_exists(personas)){
                throw new NotFound("Alguna persona no trabaja en este libro");
            }

            await LibroPersona.update(personas);
            message = 'actualizadas'

            break;
        case "DELETE":

            if (!await LibroPersona.any_exists(personas)){
                throw new Duplicated("Alguna persona ya trabaja en ese libro");
            }

            await LibroPersona.remove(personas);
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

const getVentas = async(req: Request, res: Response) => {
    const ventas = await Libro.getVentas(req.params.isbn, res.locals.user.id);
    return res.json(ventas);
}

const getOne = async(req: Request, res: Response) => {
    const libro = await Libro.getByIsbn(req.params.isbn, res.locals.user.id)
    const {autores, ilustradores} = await libro.getPersonas(res.locals.user.id);
    return res.json({
        ...libro,
        autores: autores,
        ilustradores: ilustradores
    });
}

const listaLibros = async (req: Request, res: Response) => {
    const libros = await Libro.getAll(res.locals.user.id);

    let len = Object.keys(libros[0]).length;
    let header = 'LISTA DE LIBROS' + ','.repeat(len) + '\r\n';
    let headers = Object.keys(libros[0]).join(',') + '\r\n';
    let data = libros.map(l => Object.values(l).join(',')).join('\r\n');

    let file_path = 'lista_libros.csv';
    fs.writeFileSync(file_path, header+headers+data);
    return res.download(file_path);
}

const getAll = async(req: Request, res: Response) => {
    if ("page" in req.query){
        const libros = await Libro.getPaginated(Number(req.query.page) || 0, res.locals.user.id);
        return res.json(libros);
    }

    const libros = await Libro.getAll(res.locals.user.id);
    return res.json(libros);
}

export default{
    getAll,
    getOne,
    getVentas,
    managePersonas,
    create,
    remove,
    update,
    listaLibros
}
