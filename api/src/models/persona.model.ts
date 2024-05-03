import {conn} from "../db";
import { RowDataPacket } from "mysql2/promise";
import {PersonaSchema, UpdatePersona, SavePersona} from "../schemas/persona.schema";

import { BaseModel, DBConnection } from "./base.model";
import { TipoPersona } from "../schemas/libro_persona.schema";
import { LibroSchema } from "../schemas/libros.schema";

export class Persona extends BaseModel{
    nombre: string;
    email: string;
    dni: string;
    id: number;

    static table_name: string = "personas";
    static fields = ["id", "dni", "nombre", "email"]
    static pk = 'id';

    constructor(persona: PersonaSchema) {
        super();

        this.nombre = persona.nombre;
        this.email  = persona.email || "";
        this.dni = persona.dni;
        this.id = Number(persona.id);
    }

    static async getById(id: number, userId: number): Promise<Persona> {
        return await super.find_one<PersonaSchema, Persona>({id: id, is_deleted: 0, user: userId});
    }

    static async getAll(userId: number): Promise<PersonaSchema[]> {
        return await super.find_all<PersonaSchema>({is_deleted: 0, user: userId});
    }
    
    static async exists(dni: string, userId: number): Promise<boolean>{
        return await super._exists({dni: dni, is_deleted: 0, user: userId});
    }

    static async insert(body: SavePersona, connection: DBConnection) {
        return await super._insert<SavePersona, Persona>(body, connection);
    }

    static async update(body: UpdatePersona, where: object, connection: DBConnection){
        await this._update<UpdatePersona>(body, where, connection);    
    }

    async update(body: UpdatePersona, connection: DBConnection){
        await Persona._update<UpdatePersona>(body, {
            id: this.id, 
            is_deleted: 0
        }, connection);    

        for (let i in body){
            const value = body[i as keyof typeof body];
            if (value !== undefined){
                this[i as keyof this] = value as any; 
            }
        }
    }

    static async delete(where: object, connection: DBConnection){
        await this._update({is_deleted: 1}, where, connection);
    }

    static async getAllByTipo(tipo: TipoPersona, userId: number): Promise<PersonaSchema[]> {
        const query = `
            SELECT ${this.fields.join(', ')} 
            FROM ${this.table_name} 
            INNER JOIN libros_personas
                ON id_persona=id
            WHERE is_deleted = 0
            AND libros_personas.tipo = ?
            AND ${this.table_name}.user = ?
            GROUP BY id`;

        const [rows] = await conn.query<RowDataPacket[]>(query, [tipo, userId]);
        return rows as PersonaSchema[];
    }    

    async getLibros(userId: number){
        const query = `
            SELECT libros.*, libros_personas.tipo 
            FROM libros
            INNER JOIN libros_personas
                ON libros.isbn = libros_personas.isbn
            WHERE libros_personas.id_persona = ?
            AND libros.user = ?`;

        const [rows] = await conn.query<RowDataPacket[]>(query, [this.id, userId]);
        return rows as LibroSchema[];
    }
}

