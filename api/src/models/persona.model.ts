import {conn} from "../db";
import { OkPacket, RowDataPacket } from "mysql2/promise";
import { ValidationError, NotFound, NothingChanged, Duplicated } from './errors'
import { ILibro } from "./libro.model";
import { createPersona, retrievePersona, TipoPersona } from "../schemas/persona.schema";

const table_name = "personas";
const visible_fields = "id, dni, nombre, email";

export interface IPersona extends RowDataPacket{
    nombre: string;
    email?: string;
    dni: string;
    id?: number;
    tipo?: TipoPersona;
}

//TODO: porcentaje de la persona
export class Persona{
    nombre: string;
    email: string;
    dni: string;
    id: number;
    tipo?: TipoPersona;
    libros?: ILibro[];

    //Validamos al momento de crear un objeto
    constructor(persona: retrievePersona) {
        this.nombre = persona.nombre;
        this.email  = persona.email || "";
        this.dni = persona.dni;
        this.id = Number(persona.id);
    }
    
    static validate(request: IPersona) {
        if (!request.nombre)
            throw new ValidationError("El nombre es obligatorio");

        if (!request.dni)
            throw new ValidationError("El dni es obligatorio");
    }

    static async exists(dni: string): Promise<boolean>{
        let res: number = (await conn.query<RowDataPacket[]>(`
            SELECT COUNT(id) as count from ${table_name}
            WHERE dni = ?
            AND is_deleted = 0
        `, [dni]))[0][0].count;

        return res > 0;
    }

    static async insert(p: createPersona) {
        let _persona: createPersona = {
            nombre: p.nombre,
            dni: p.dni,
            email: p.email || ""
        }

        if (await Persona.exists(_persona.dni)){
            throw new Duplicated(`La persona con dni ${_persona.dni} ya se encuentra cargada`);
        }

        let res = (await conn.query<OkPacket>(`
            INSERT INTO ${table_name} SET ?`
        , _persona))[0];

        return new Persona({..._persona, id: res.insertId})
    }

    async update(req: IPersona) {
        if (req.dni && req.dni != this.dni){
            if (await Persona.exists(req.dni))
                throw new Duplicated(`La persona con dni ${req.dni} ya se encuentra cargada`);
        }

        this.nombre = req.nombre || this.nombre;
        this.email  = req.email  || this.email;
        this.dni    = req.dni    || this.dni;

        const query = `
            UPDATE ${table_name} SET ?
            WHERE id = ?
            AND is_deleted = 0`;

        let res = (await conn.query<OkPacket>(query, [this, this.id]))[0];

        if (res.affectedRows == 0)
            throw new NotFound(`No se encuentra la persona con id ${this.id}`);

        if (res.changedRows == 0)
            throw new NothingChanged('Ningun valor es distinto a lo que ya existia en la base de datos');
    }

    static async delete(id: number){
        /*await conn.query(`
            DELETE FROM libros_personas
            WHERE id_persona = ${id}
        `);*/

        /*let res = (await conn.query(`
            DELETE FROM ${table_name}
            WHERE id=${id}`
        ))[0];*/

        const query = `
            UPDATE ${table_name}
            SET is_deleted = 1
            WHERE id = ?`;

        let res = (await conn.query<OkPacket>(query, [id]))[0];

        if (res.affectedRows == 0)
            throw new NotFound(`No se encuentra la persona con id ${id}`);
    }

    static async get_all(): Promise<IPersona[]> {
        let personas = (await conn.query<IPersona[]>(`
            SELECT ${visible_fields} FROM ${table_name} 
            WHERE is_deleted = 0
        `))[0];
            
        return personas;
    }

    static async get_all_by_tipo(tipo: TipoPersona): Promise<IPersona[]> {
        const query = `
            SELECT ${visible_fields} FROM ${table_name} 
            INNER JOIN libros_personas
                ON id_persona=id
            WHERE is_deleted = 0
            AND libros_personas.tipo = ?
            GROUP BY id`

        return (await conn.query<IPersona[]>(query, [tipo]))[0];
    }

    static async get_by_id(id: number): Promise<Persona> {
        const query = `
            SELECT ${visible_fields} FROM ${table_name} 
            WHERE id = ?
            AND is_deleted = 0`

        let personas = (await conn.query<RowDataPacket[]>(query, [id]))[0];

        if (!personas.length)
            throw new NotFound(`La persona con id ${id} no se encontro`);

        return new Persona(personas[0] as retrievePersona);
    }

    async get_libros(){
        const query = `
            SELECT libros.*, libros_personas.tipo 
            FROM libros
            INNER JOIN libros_personas
                ON libros_personas.id_persona = ?
            INNER JOIN ${table_name}
                ON libros.isbn = libros_personas.isbn
            WHERE personas.id = ?
            AND personas.is_deleted = 0
        `

        this.libros = (await conn.query<ILibro[]>(query, [this.id, this.id]))[0];
    }
}

