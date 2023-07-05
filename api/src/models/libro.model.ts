import {conn} from "../db"
import { OkPacket, RowDataPacket } from "mysql2/promise";
import {Persona, IPersona} from "./persona.model"
import {createLibro, createPersonaLibroInDB, createPersonaLibroNOTInDB, retrieveLibro} from "../schemas/libros.schema";
import {TipoPersona} from "../schemas/persona.schema";
import {ValidationError, NotFound, Duplicated, NothingChanged} from './errors'

const table_name = "libros"
const visible_fields = "titulo, isbn, fecha_edicion, precio, stock"

export interface ILibro extends RowDataPacket{
    titulo: string;
    isbn: string;
    fecha_edicion: Date;
    precio: number;
    stock: number;
}

export class Libro{
    titulo: string;
    isbn: string;
    fecha_edicion: Date;
    precio: number;
    stock: number;

    constructor(request: retrieveLibro) {
        this.titulo = request.titulo;
        this.isbn   = request.isbn;
        this.fecha_edicion = request.fecha_edicion;
        this.precio = request.precio;
        this.stock  = request.stock || 0
    }

    //Validate the request
    static validate(request: ILibro) {
        if (!request.titulo)
            throw new ValidationError("El titulo es obligatorio")

        if (!request.isbn)
            throw new ValidationError("El isbn es obligatorio")

        if (!request.fecha_edicion)
            throw new ValidationError("La fecha de edicion es obligatoria")

        if (!('precio' in request))
            throw new ValidationError("El precio es obligatorio")
    }

    static validate_persona(persona: Persona){
        if (!('tipo' in persona)) 
            throw new ValidationError("Se debe pasar 'tipo' en todas las personas");
        
        if (!('id' in persona))
            throw new ValidationError("Se debe pasar 'id' en todas las personas");
        
        if (!Object.values(TipoPersona).includes(<TipoPersona>persona.tipo))
            throw new ValidationError("Un tipo pasado no es correcto [0, 1]");
    }

    static async is_duplicated(isbn: string): Promise<void>{
        let result = await conn.query(`
            SELECT COUNT(isbn) as count from ${table_name}
            WHERE ${table_name}.isbn = ?
            AND is_deleted = 0
        `, [isbn]);

        const count = (<RowDataPacket> result)[0][0].count;
        
        if (count > 0)
            throw new Duplicated(`El libro con isbn ${isbn} ya existe`);
    }

    async insert() {
        await conn.query("INSERT INTO libros SET ?", this);
    }
    
    async update(req: ILibro){
        console.log("request:", req);

        this.titulo = req.titulo || this.titulo;
        this.precio = req.precio || this.precio;
        this.fecha_edicion = req.fecha_edicion || this.fecha_edicion;
        if ('stock' in req)
            this.stock = req.stock;

        console.log("libro stock", this.stock);

        let res = (await conn.query<OkPacket>(`
            UPDATE ${table_name}
            SET ?
            WHERE isbn = ?
            AND is_deleted = 0
        `, [this, this.isbn]))[0]
        
        if (res.affectedRows == 0)
            throw new NotFound(`No se encuentra el libro con isbn ${this.isbn}`);

        if (res.changedRows == 0)
            throw new NothingChanged('Ningun valor es distinto a lo que ya existia en la base de datos');
    }

    async update_stock(stock: number){
        await conn.query(`
            UPDATE ${table_name}
            SET stock  = ?
            WHERE isbn = ?
            AND is_deleted = 0
        `, [this.stock+stock, this.isbn]);
    }

    static async delete(isbn: string){
        await conn.query(`
            DELETE FROM libros_personas
            WHERE isbn = ?
        `, [isbn]);

        const query = `
            UPDATE ${table_name}
            SET is_deleted = 1
            WHERE isbn = ?
            AND is_deleted = 0`;

        let res = (await conn.query<OkPacket>(query, [isbn]))[0];

        if (res.affectedRows == 0)
            throw new NotFound(`No se encuentra el libro con isbn ${isbn}`);   
    }

    static async get_by_isbn(isbn: string): Promise<Libro> {
        const query = `
            SELECT * FROM ${table_name} 
            WHERE ${table_name}.isbn = ?`

        let response = (await conn.query<ILibro[]>(query, [isbn]))[0];

        if (!response.length)
            throw new NotFound(`El libro con isbn ${isbn} no se encontro`)
        
        if(response[0].is_deleted == 1)
            throw new NotFound(`El libro con isbn ${isbn} esta dado de baja`)

        return new Libro(response[0]);
    }

    async get_personas(): Promise<{autores: IPersona[], ilustradores: IPersona[]}>{
        const query = `
            SELECT personas.id, dni, nombre, email, libros_personas.tipo, libros_personas.porcentaje
            FROM personas 
            INNER JOIN libros_personas
            INNER JOIN ${table_name}
                ON personas.id  = libros_personas.id_persona
            AND ${table_name}.isbn = libros_personas.isbn
            WHERE ${table_name}.isbn = ?
            AND ${table_name}.is_deleted = 0`

        const [personas] = await conn.query<IPersona[]>(query, [this.isbn]);
        return {
            autores: personas.filter(p => p.tipo == TipoPersona.autor),
            ilustradores: personas.filter(p => p.tipo == TipoPersona.ilustrador) 
        };
    }

    static async get_ventas(isbn: string){
        let ventas = (await conn.query(`
            SELECT  
                ventas.id as id_venta, fecha, medio_pago, total, file_path,
                id_cliente
            FROM libros_ventas
            INNER JOIN ventas
                ON ventas.id = libros_ventas.id_venta
            WHERE libros_ventas.isbn = ${isbn}
        `))[0];

        return ventas;
    }

    static async get_all(): Promise<ILibro[]>{        
        const query = `
            SELECT ${visible_fields}
            FROM ${table_name}
            WHERE is_deleted = 0`

        let [libros] = await conn.query<ILibro[]>(query);
        return libros;
    }

    static async get_paginated(page = 0): Promise<ILibro[]>{
        let libros_per_page = 10;
        const query = `
            SELECT ${visible_fields}
            FROM ${table_name}
            WHERE is_deleted = 0
            LIMIT ${libros_per_page}
            OFFSET ${page * libros_per_page}`

        const [libros] = await conn.query<ILibro[]>(query);
        return libros;
    }

    async add_personas(personas: createPersonaLibroInDB[]){
        for (let persona of personas) {

            const query = `
                SELECT id_persona, tipo 
                FROM libros_personas 
                WHERE (isbn, id_persona, tipo) in ((?, ?, ?))`

            let res = (<RowDataPacket> await conn.query(query, [this.isbn, persona.id, persona.tipo]))[0]

            if (res.length > 0)
                throw new Duplicated(`La persona ${persona.id} ya es un ${TipoPersona[persona.tipo]} del libro ${this.isbn}`);
        }

        for (let persona of personas){
            await conn.query(`
                INSERT INTO libros_personas 
                SET id_persona=${persona.id},
                porcentaje=${persona.porcentaje || 0},
                tipo=${persona.tipo},
                isbn=${this.isbn}
            `);
        }
    }

    async update_personas(personas: createPersonaLibroInDB[]){
        for (let persona of personas) {
            if (persona.porcentaje){
                const query: string = `
                    UPDATE libros_personas 
                    SET porcentaje = ?
                    WHERE isbn = ?
                    AND id_persona = ?
                    AND tipo = ?`

                await conn.query<OkPacket>(query, [persona.porcentaje, this.isbn ,persona.id, persona.tipo])
            }
        }
    }
    
    async remove_personas(personas: createPersonaLibroInDB[]){
        let persona_libro = personas.map(p => `('${this.isbn}', ${p.id}, ${p.tipo})`).join(', ');  //((isbn, id, tipo), (isbn, id, tipo) ...) String

        const query = `
            DELETE FROM libros_personas
            WHERE (isbn, id_persona, tipo) in (${persona_libro})`;

        if (personas.length > 0){
            let res = (await conn.query<OkPacket>(query))[0];

            if (res.affectedRows == 0)
                throw new NotFound(`Ninguna persona pasada trabaja en este libro con el tipo pasado`)
        }
    }
}
