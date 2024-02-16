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
    constructor(body: retrieveLibroPersona) {
        super();

        this.tipo = body.tipo;
        this.porcentaje  = body.porcentaje;
        this.isbn = body.isbn;
        this.id = body.id;
    }

    static async get_one(body: removePersonaLibro): Promise<LibroPersona>{
        return super.find_one<removePersonaLibro, LibroPersona>(body);
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

