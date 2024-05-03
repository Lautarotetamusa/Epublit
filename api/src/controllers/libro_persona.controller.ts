import {Request, Response} from "express";
import { Persona } from "../models/persona.model";
import { Libro } from "../models/libro.model";
import { 
    libroPersonaKey,
    libroPersonaSchema,
} from "../schemas/libro_persona.schema";
import { Duplicated, NotFound } from "../models/errors"
import { LibroPersona } from "../models/libro_persona.model";
import { conn } from "../db";

function makeResponse(res: Response, libro: Libro, personas: any[], method: "put" | "post" | "delete"): Response {
    let message: string;
    let code: number;
    switch (method){
        case "delete":
            message = "eliminadas";
            code = 200;
            break;
        case "post":
            message = "agregadas";
            code = 201;
            break;
        case "put":
            message = "actualizadas";
            code = 201;
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

const addLibroPersonas = async(req: Request, res: Response) => {
    let body = Array.isArray(req.body) ? req.body : [req.body]; 

    const libro = await Libro.getByIsbn(req.params.isbn, res.locals.user.id);
    body = body.map((p: any) => ({...p, isbn: libro.isbn, id_libro: libro.id_libro}));
    const personas = libroPersonaSchema.array().parse(body);

    if (await LibroPersona.any_exists(personas.map(p => ({id_libro: p.id_libro, id_persona: p.id_persona})))){
        throw new Duplicated("Alguna persona ya trabaja en ese libro");
    }
    if (!await Persona.all_exists(personas.map(p => ({id: p.id_persona})))){
        throw new NotFound("Alguna persona no existe");
    }

    await LibroPersona.insert(personas, conn);

    return makeResponse(res, libro, personas, "post");
};

const updateLibroPersonas = async(req: Request, res: Response) => {
    let body = Array.isArray(req.body) ? req.body : [req.body]; 

    const libro = await Libro.getByIsbn(req.params.isbn, res.locals.user.id);
    body = body.map((p: any) => ({...p, isbn: libro.isbn, id_libro: libro.id_libro}));
    const personas = libroPersonaSchema.array().parse(body);
    const personasKeys = personas.map(p => { return {
        id_libro: p.id_libro,
        id_persona: p.id_persona,
        tipo: p.tipo
    }});

    if (!await LibroPersona.all_exists(personasKeys)){
        throw new NotFound("Alguna persona no trabaja en este libro");
    }

    await LibroPersona.update(personas, conn);

    return makeResponse(res, libro, personas, "put");
};

const deleteLibroPersonas = async(req: Request, res: Response) => {
    let body = Array.isArray(req.body) ? req.body : [req.body]; 

    const libro = await Libro.getByIsbn(req.params.isbn, res.locals.user.id);
    body = body.map((p: any) => ({...p, id_libro: libro.id_libro}));
    const personas = libroPersonaKey.array().parse(body);

    await LibroPersona.remove(personas, conn);

    return makeResponse(res, libro, personas, "delete");
};

export default{
    addLibroPersonas,
    updateLibroPersonas,
    deleteLibroPersonas
}
