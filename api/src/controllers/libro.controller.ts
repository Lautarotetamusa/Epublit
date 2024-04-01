import {Request, Response} from "express";
import { Persona } from "../models/persona.model";
import { Libro } from "../models/libro.model";
import { 
    CreateLibroPersona,
    LibroPersonaSchema,
    tipoPersona, 
} from "../schemas/libro_persona.schema";
import { ValidationError } from "../models/errors"
import { LibroPersona } from "../models/libro_persona.model";

import fs from 'fs';
import {  createLibro, updateLibro } from "../schemas/libros.schema";
import { LibroPrecio } from "../models/libroPrecio.model";

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
    
    await LibroPrecio.insert(libroBody.isbn, libroBody.precio);

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
    const isbn = req.params.isbn;

    const libro = await Libro.getByIsbn(isbn, user);

    //Solamente creamos un nuevo precio si el precio es distinto
    if ('precio' in body && body.precio && libro.precio != body.precio){
        await LibroPrecio.insert(isbn, body.precio);
    }
    await libro.update(body, user);

    return res.status(201).json({
        success: true,
        message: `Libro con isbn ${req.params.isbn} actualizado correctamente`,
        data: libro
    })
}

const getVentas = async(req: Request, res: Response) => {
    const ventas = await Libro.getVentas(req.params.isbn, res.locals.user.id);
    return res.json(ventas);
}

const getPrecios = async(req: Request, res: Response) => {
    const precios = await LibroPrecio.getPreciosLibro(req.params.isbn);
    return res.json(precios);
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
    getPrecios,
    create,
    remove,
    update,
    listaLibros
}
