import {conn} from "../db";
import { RowDataPacket } from "mysql2/promise";
import {PersonaSchema, CreatePersona, UpdatePersona} from "../schemas/persona.schema";

import { BaseModel } from "./base.model";
import { tipoPersona, TipoPersona } from "../schemas/libro_persona.schema";

export class Persona extends BaseModel{
    nombre: string;
    email: string;
    dni: string;
    id: number;

    static table_name: string = "personas";
    static fields = ["id", "dni", "nombre", "email"]

    constructor(persona: PersonaSchema) {
        super();

        this.nombre = persona.nombre;
        this.email  = persona.email || "";
        this.dni = persona.dni;
        this.id = Number(persona.id);
    }

    static async get_by_id(id: number): Promise<Persona> {
        return await super.find_one<PersonaSchema, Persona>({id: id, is_deleted: 0});
    }

    static async get_all(): Promise<PersonaSchema[]> {
        return await super.find_all<PersonaSchema>({is_deleted: 0});
    }
    
    static async exists(dni: string): Promise<boolean>{
        return await super._exists({dni: dni, is_deleted: 0});
    }

    static async insert(p: CreatePersona) {
        return await super._insert<CreatePersona, Persona>(p);
    }

    static async update(body: UpdatePersona, where: object){
        await this._update<UpdatePersona>(body, where);    
    }

    async update(body: UpdatePersona){
        await Persona._update<UpdatePersona>(body, {
            id: this.id, 
            is_deleted: 0
        });    

        for (let i in body){
            const value = body[i as keyof typeof body];
            if (value !== undefined){
                this[i as keyof this] = value as any; 
            }
        }
    }

    static async delete(where: object){
        await this._update({is_deleted: 1}, where);
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

        const [rows] = await conn.query<RowDataPacket[]>(query, [tipoPersona[tipo]]);
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
        return rows as retrieveLibro[];
    }
}

