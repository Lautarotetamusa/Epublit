import {Request, Response} from "express";

import { Persona, TipoPersona } from "../models/persona.model.js";
import { Libro, ILibro } from "../models/libro.model.js";
import { parse_error } from "../models/errors.js"

function parse_req(body: ILibro): {indb: Persona[], not_indb: Persona[]}{
    //Persona.tipos agregando 'es' al final: [autores, ilustradores]
    let tipos_keys = Object.keys(TipoPersona).map(k => k+"es");

    tipos_keys.forEach(tipo => {
        //Validamos que "autores" o "ilustradores" exista, si no existe le asignamos una lista vacia
        if (!body[tipo]) body[tipo] = []
        //Validamos que "autores" o "ilustradores" sea de tipo [], si es de tipo {} creamos una lista con un solo elemento: [{obj}]
        if (!Array.isArray(body[tipo])) body[tipo] = [body[tipo]]
        
        //Asignamos el tipo dependiendo de en que lista está, si está en "autores" o en "ilustradores"
        body[tipo].map(a => {
            a.tipo = tipos_keys.indexOf(tipo)
        });
    });

    //Concatenamos las dos listas y las devolvemos
    let personas: IPersona[] = body.autores.concat(body.ilustradores);

    //Separamos los objetos que hay que crear(not_in_db) de los objetos que ya se encuentran en la DB(in_db)
    return {
        indb:     personas.filter(p => "id" in p),    //Lista de las personas que todavia no estan en la DB
        not_indb: personas.filter(p => !("id" in p))  //Lista de ids de las personas que ya están en la DB
    }
}

const create = async (req: Request, res: Response) => {
    console.log(req.body);

    try {
        let personas_data = Array<Persona>;  //Lista de personas validas y cargadas

        Libro.validate(req.body);                      //Validar la request

        await Libro.is_duplicated(req.body.isbn);
        const {indb, not_indb} = parse_req(req.body);  //Parsear la request

        //Validar los datos de las personas que no estan en la DB
        for (let i in not_indb){
            Persona.validate(not_indb[i]);    
        }

        //Validar que los ids existan en la DB
        for (let i in indb){
            let persona: Persona = await Persona.get_by_id(indb[i].id);
            persona.tipo = indb[i].tipo;

            personas_data.push(persona); //Cargar la data de las personas con esas IDs
            console.log("indb tipo:", personas_data.tipo);
        }
        
        //Insertar cada persona en la base de datos
        for (let i in not_indb){
            let persona: Persona = new Persona(not_indb[i])
            await persona.insert();

            indb.push({id: persona.id, tipo: not_indb[i].tipo}); //Agregar las personas cargadas a la lista de lo que ya esta en db
        }

        //Unir la lista de personas insertadas con las que ya existian
        personas_data = personas_data.concat(not_indb);
        console.log("personas_data:", personas_data);

        //Crear el libro
        const libro = new Libro(req.body);

        console.log("INDB", indb);
        await libro.insert(indb);

        return res.status(201).json({
            success: true,
            message: `Libro con isbn ${req.body.isbn} creado correctamente`,
            data: {
                ...libro,
                autores:      personas_data.filter(p => p.tipo == Persona.tipos["autor"]),
                ilustradores: personas_data.filter(p => p.tipo == Persona.tipos["ilustrador"]),
            }
        })

    } catch (error) {
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
    } catch (error) {
        return parse_error(res, error); 
    }
}

const update = async(req: Request, res: Response) => {
    try {
        let libro = await Libro.get_by_isbn(req.params.isbn);
        await libro.update(req.body);

        return res.status(201).json({
            success: true,
            message: `Libro con isbn ${req.params.isbn} actualizado correctamente`,
            data: libro
        })
    } catch (error) {
        return parse_error(res, error);
    }
}

const manage_personas = async(req: Request, res: Response) => {
    let personas = Array.isArray(req.body) ? req.body : [req.body]; //Hacemos que personas sea un array si o si

    let code = 201
    let message = 'creada'
    
    try {
        for (let i in personas) {
            Libro.validate_persona(personas[i]);
            await Persona.get_by_id(personas[i].id); //Check if the person exists
        }

        let libro = await Libro.get_by_isbn(req.params.isbn);

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
            
        await libro.get_personas();

        return res.status(code).json({
            success: true,
            message: `Personas ${message} con exito`,
            data: libro
        });

    } catch (error) {
        return parse_error(res, error);
    }
}

const get_ventas = async(req: Request, res: Response) => {
    try {
        let ventas = await Libro.get_ventas(req.params.isbn);
        return res.json(ventas);
    } catch (error) {
        return parse_error(res, error);
    }
}

const get_one = async(req: Request, res: Response) => {
    try {
        let libro = await Libro.get_by_isbn(req.params.isbn)
        await libro.get_personas();
        return res.json(libro);
    } catch (error) {
        return parse_error(res, error);
    }
}

const get_all = async(req: Request, res: Response) => {
    try {
        let libros = [];
        if ("page" in req.query){
            libros = await Libro.get_paginated(req.query.page || 0);
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