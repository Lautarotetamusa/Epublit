import {conn} from "../db";
import { RowDataPacket } from "mysql2/promise";
import { createPersona, retrievePersona, updatePersona } from "../schemas/persona.schema";

import { BaseModel } from "./base.model";
import { TipoPersona } from "../schemas/libro_persona.schema";
import { retrieveLibro } from "../schemas/libros.schema";

export class Persona extends BaseModel{
    nombre: string;
    email: string;
    dni: string;
    id: number;
    libros?: retrieveLibro[];

    static table_name: string = "personas";
    static fields = ["id", "dni", "nombre", "email"]

    //Validamos al momento de crear un objeto
    constructor(persona: retrievePersona) {
        super();

        this.nombre = persona.nombre;
        this.email  = persona.email || "";
        this.dni = persona.dni;
        this.id = Number(persona.id);
    }

    static async get_by_id(id: number): Promise<Persona> {
        return await super.find_one<retrievePersona, Persona>({id: id, is_deleted: 0});
    }

    static async get_all(): Promise<retrievePersona[]> {
        return await super.find_all<retrievePersona>({is_deleted: 0});
    }
    
    static async exists(dni: string): Promise<boolean>{
        return await super._exists({dni: dni, is_deleted: 0});
    }

    static async insert(p: createPersona) {
        return await super._insert<createPersona, Persona>(p);
    }

    static async update(body: updatePersona, where: object){
        await this._update<updatePersona>(body, where);    
    }

    /**
     * const p = Persona.get_one({id: 1}); \
     * p.update({nombre: "Lautaro"})
     * @param body 
     * @param _where 
     */
    async update(body: updatePersona){
        await Persona._update<updatePersona>(body, {
            id: this.id, 
            is_deleted: 0
        });    

        for (let i in body){
            let value = body[i as keyof typeof body];
            if (value !== undefined)
                this[i as keyof updatePersona] = value; 
        }
    }

    static async delete(_where: object){
        await this._update({is_deleted: 1}, _where);
    }

    static async get_all_by_tipo(tipo: TipoPersona): Promise<RowDataPacket[]> {
        const query = `
            SELECT ${this.fields.join(', ')} 
            FROM ${this.table_name} 
            INNER JOIN libros_personas
                ON id_persona=id
            WHERE is_deleted = 0
            AND libros_personas.tipo = ?
            GROUP BY id`;

        const [rows] = await conn.query<RowDataPacket[]>(query, [tipo]);
        return rows;
    }    

    async get_libros(){
        const query = `
            SELECT libros.*, libros_personas.tipo 
            FROM libros
            INNER JOIN libros_personas
                ON libros.isbn = libros_personas.isbn
            WHERE personas.id = ?
            AND personas.is_deleted = 0`;

        const [rows] = await conn.query<RowDataPacket[]>(query, [this.id]);
        this.libros = rows as retrieveLibro[];
    }
}

