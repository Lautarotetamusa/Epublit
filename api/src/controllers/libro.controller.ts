import {Request, Response} from "express";
import { Persona } from "../models/persona.model";
import { Libro } from "../models/libro.model";
import { 
    LibroPersonaSchema,
    tipoPersona, 
} from "../schemas/libro_persona.schema";
import { ValidationError } from "../models/errors"
import { LibroPersona } from "../models/libro_persona.model";

import fs from 'fs';
import {  createLibro, updateLibro } from "../schemas/libros.schema";
import { LibroPrecio } from "../models/libroPrecio.model";
import { conn } from "../db";

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
    const userId = res.locals.user.id;
    const connection = await conn.getConnection();

    const {autores, ilustradores, ...libroBody} = createLibro.parse(req.body);
    let indb: LibroPersonaSchema[] = [];
    let notIndb = [];

    let personas = [];
    for (const a of autores){
        personas.push({...a, tipo: tipoPersona.autor});
    }
    for (const i of ilustradores){
        personas.push({...i, tipo: tipoPersona.ilustrador});
    }
    
    try{
        await connection.beginTransaction();

        await Libro.is_duplicated(libroBody.isbn, userId);
        const libro = await Libro.insert({
            ...libroBody,
            user: userId
        }, connection);
        console.log("libro:", libro);
        connection.release();

        for (const persona of personas){
            if ("id_persona" in persona){
                indb.push({
                    ...persona,
                    isbn: libroBody.isbn,
                    id_libro: libro.id_libro 
                });
            }else{
                notIndb.push(persona);
            }
        }

        indb = removeDuplicateds(indb);       

        if (!await Persona.all_exists(indb.map(p => ({id: p.id_persona, user: userId})))){
            throw new ValidationError("Alguna persona no existe");
        }

        if(await Persona.any_exists(notIndb.map(p => ({dni: p.dni, user: userId})))){
            throw new ValidationError("Alguna persona ya se encuentra cargada");
        }

        for (const personaBody of notIndb){
            const persona = await Persona.insert({
                nombre: personaBody.nombre,
                email: personaBody.email,
                dni: personaBody.dni,
                user: userId
            }, connection);
            connection.release();

            indb.push({
                porcentaje: personaBody.porcentaje, 
                id_persona: persona.id,
                tipo: personaBody.tipo, 
                isbn: libroBody.isbn,
                id_libro: libro.id_libro
            });
        }

        await LibroPrecio.insert({
            isbn: libroBody.isbn, 
            precio: libroBody.precio, 
            user: userId,
            id_libro: libro.id_libro
        }, connection);
        connection.release();

        await LibroPersona.insert(indb, connection);
        connection.release();

        await connection.commit();

        return res.status(201).json({
            success: true,
            message: `Libro con isbn ${libroBody.isbn} creado correctamente`,
            data: {
                ...libro,
                autores:      indb.filter(p => p.tipo == tipoPersona.autor),
                ilustradores: indb.filter(p => p.tipo == tipoPersona.ilustrador),
            }
        });
    }catch(err: any) {
        await connection.rollback();
        throw err;
    }finally{
        connection.release();
    }
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
        await LibroPrecio.insert({
            isbn: isbn, 
            precio: body.precio, 
            user: user,
            id_libro: libro.id_libro
        }, conn);
    }
    await libro.update(body, user, conn);

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

    const withStock = (String(req.query.stock).toLowerCase() === 'true')

    const libros = await Libro.getAll(res.locals.user.id, withStock);
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
