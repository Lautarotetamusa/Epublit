import {conn} from "../db"
import { OkPacket, RowDataPacket } from "mysql2/promise";
import {Persona, TipoPersona, IPersona} from "./persona.model"
import {ValidationError, NotFound, Duplicated, NothingChanged} from './errors'

const table_name = "libros"
const visible_fields = "titulo, isbn, fecha_edicion, precio, stock"

export interface ILibro extends RowDataPacket{
    titulo: string;
    isbn: string;
    fecha_edicion: Date;
    precio: number;
    stock: number;
    autores?: IPersona[];
    ilustradores?: IPersona[];
}

export interface ILibro_Persona{
    porcentaje: number;
    id_persona: number;
    tipo: TipoPersona;
}

export class Libro{
    titulo: string;
    isbn: string;
    fecha_edicion: Date;
    precio: number;
    stock: number;
    autores?: IPersona[];
    ilustradores?: IPersona[];

    constructor(request: ILibro) {
        this.titulo = request.titulo;
        this.isbn   = request.isbn;
        this.fecha_edicion = request.fecha_edicion;
        this.precio = request.precio;
        this.stock  = request.stock || 0;
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

    async insert(personas: ILibro_Persona[]) {
        await conn.query("INSERT INTO libros SET ?", this);
        await this.add_personas(personas);
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

    static async delete(isbn: number){
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

    static async get_by_isbn(isbn: number): Promise<Libro> {
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

    async get_personas(){
        let personas = (await conn.query<IPersona[]>(`
            SELECT personas.id, dni, nombre, email, libros_personas.tipo, libros_personas.porcentaje
            FROM personas 
            INNER JOIN libros_personas
            INNER JOIN ${table_name}
                ON personas.id  = libros_personas.id_persona
            AND ${table_name}.isbn = libros_personas.isbn
            WHERE ${table_name}.isbn = ${this.isbn}
            AND ${table_name}.is_deleted = 0
        `))[0];

        this.autores      = personas.filter(p => p.tipo == TipoPersona.autor);
        this.ilustradores = personas.filter(p => p.tipo == TipoPersona.ilustrador);
    }

    /*static async get_ventas(isbn: string): Venta[]{
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
    }*/

    //TODO: Se hace una consulta a la DB por libro, no se si hay otra manera más rápida de hacerlo
    static async get_all(): Promise<ILibro[]>{        
        let libros = (await conn.query<ILibro[]>(`
            SELECT ${visible_fields}
            FROM ${table_name}
            WHERE is_deleted = 0
        `))[0];

        return libros;
    }

    static async get_paginated(page = 0): Promise<ILibro[]>{
        let libros_per_page = 10;

        let libros = (await conn.query<ILibro[]>(`
            SELECT ${visible_fields}
            FROM ${table_name}
            WHERE is_deleted = 0
            LIMIT ${libros_per_page}
            OFFSET ${page * libros_per_page}
        `))[0];

        return libros;
    }

    async add_personas(personas: ILibro_Persona[]){
        for (let persona of personas) {

            const query = `
                SELECT id_persona, tipo 
                FROM libros_personas 
                WHERE (isbn, id_persona, tipo) in ((?, ?, ?))`

            let res = (<RowDataPacket> await conn.query(query, [this.isbn, persona.id_persona, persona.tipo]))[0]
            
            console.log("res:", res.length);

            if (res.length > 0)
                console.log("duplicated");//throw new Duplicated(`La persona ${persona.id} ya es un ${Persona.str_tipos[persona.tipo]} del libro ${this.isbn}`);
            else
                await conn.query(`
                    INSERT INTO libros_personas 
                    SET id_persona=${persona.id_persona},
                    porcentaje=${persona.porcentaje || 0},
                    tipo=${persona.tipo},
                    isbn=${this.isbn}
                `);
        }
    }

    async update_personas(personas: ILibro_Persona[]){
        for (let persona of personas) {
            if (persona.porcentaje){
                const query: string = `
                    UPDATE libros_personas 
                    SET porcentaje = ?
                    WHERE isbn = ?
                    AND id_persona = ?
                    AND tipo = ?`

                await conn.query<OkPacket>(query, [persona.porcentaje, persona.id_persona, persona.tipo])
            }
        }
    }
    
    async remove_personas(personas: ILibro_Persona[]){
        let persona_libro = personas.map(p => `('${this.isbn}', ${p.id_persona}, ${p.tipo})`).join(', ');  //((isbn, id, tipo), (isbn, id, tipo) ...) String

        const query = `
            DELETE FROM libros_personas
            WHERE (isbn, id_persona, tipo) in (?)`;

        if (personas.length > 0){
            let res = (await conn.query<OkPacket>(query, [persona_libro]))[0];

            if (res.affectedRows == 0)
                throw new NotFound(`Ninguna persona pasada trabaja en este libro con el tipo pasado`)
        }
    }
}
