import {conn} from "../db";
import { RowDataPacket, OkPacket } from "mysql2/promise";
import { createPersonaLibroInDB, updateLibroPersona, removePersonaLibro } from "../schemas/libro_persona.schema";

import { BaseModel } from "./base.model";
import { TipoPersona, retrieveLibroPersona } from "../schemas/libro_persona.schema";
import { Duplicated, NotFound } from "./errors";

export class LibroPersona extends BaseModel{
    tipo: TipoPersona;
    porcentaje: number;
    isbn: string;
    id: number;

    static table_name: string = "libros_personas";
    static fields = ["tipo", "porcentaje"]

    //Validamos al momento de crear un objeto
    constructor(_req: retrieveLibroPersona) {
        super();

        this.tipo = _req.tipo;
        this.porcentaje  = _req.porcentaje;
        this.isbn = _req.isbn;
        this.id = _req.id;
    }

    static async exists(_persona: createPersonaLibroInDB): Promise<boolean>{
        const query = `
            SELECT id_persona, tipo 
            FROM ${this.table_name} 
            WHERE (isbn, id_persona, tipo) in ((?, ?, ?))`

        const [rows] = await conn.query<RowDataPacket[]>(query, [_persona.isbn, _persona.id, _persona.tipo]);
        let res = (<RowDataPacket> await conn.query(query, [_persona.isbn, _persona.id, _persona.tipo]))[0]

        return res.length > 0;
    }

    static async insert(personas: createPersonaLibroInDB[]){
        for (let persona of personas) {
            if (await this.exists(persona))
                throw new Duplicated(`La persona ${persona.id} ya es un ${TipoPersona[persona.tipo]} del libro ${persona.isbn}`);
        }

        for (let persona of personas){
            await super._insert({
                tipo: persona.tipo,
                porcentaje: persona.porcentaje,
                isbn: persona.isbn,
                id_persona: persona.id
            });
        }
    }
    
    static async update(personas: updateLibroPersona[]){
        for (let persona of personas) {
            if (persona.porcentaje){
                await LibroPersona._update({
                    porcentaje: persona.porcentaje
                }, {
                    isbn: persona.isbn, 
                    id_persona: persona.id, 
                    tipo: persona.tipo
                });
            }
        }
    }

    static async remove(personas: removePersonaLibro[]){
        let persona_libro = personas.map(p => `('${p.isbn}', ${p.id}, ${p.tipo})`).join(', ');  //((isbn, id, tipo), (isbn, id, tipo) ...) String

        const query = `
            DELETE FROM libros_personas
            WHERE (isbn, id_persona, tipo) in (${persona_libro})`;

        if (personas.length > 0){
            const [rows] = await conn.query<OkPacket>(query);

            if (rows.affectedRows == 0)
                throw new NotFound(`Ninguna persona pasada trabaja en este libro con el tipo pasado`)
        }
    }
}

