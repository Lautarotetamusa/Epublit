import {conn} from "../db";
import { RowDataPacket } from "mysql2/promise";
import { createPersonaLibroInDB, updateLibroPersona, removePersonaLibro } from "../schemas/libro_persona.schema";

import { BaseModel } from "./base.model";
import { TipoPersona, retrieveLibroPersona } from "../schemas/libro_persona.schema";

export class LibroPersona extends BaseModel{
    tipo: TipoPersona;
    porcentaje: number;
    isbn: string;
    id: number;

    static table_name: string = "libros_personas";
    static fields = ["tipo", "porcentaje"];
    static pk = ["tipo", "isbn", "id_persona"];

    //Validamos al momento de crear un objeto
    constructor(_req: retrieveLibroPersona) {
        super();

        this.tipo = _req.tipo;
        this.porcentaje  = _req.porcentaje;
        this.isbn = _req.isbn;
        this.id = _req.id;
    }

    static async get_one(_req: removePersonaLibro): Promise<LibroPersona>{
        return super.find_one<removePersonaLibro, LibroPersona>(_req);
    }

    static async exists(p: removePersonaLibro): Promise<boolean>{
        const rows = await super._bulk_select([{id_persona: p.id, tipo: p.tipo, isbn: p.isbn}]);
        return rows.length > 0;
    }

    static async insert(personas: createPersonaLibroInDB[]){
        await super._bulk_insert(personas.map(p => ({
            id_persona: p.id, isbn: p.isbn, tipo: p.tipo, porcentaje: p.porcentaje
        })));
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
        await super._bulk_remove(personas.map(p => ({
            id_persona: p.id, isbn: p.isbn, tipo: p.tipo
        })));
    }
}

