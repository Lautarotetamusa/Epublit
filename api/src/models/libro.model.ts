import { conn } from "../db"
import { OkPacket, RowDataPacket } from "mysql2/promise";
import { LibroSchema, UpdateLibro } from "../schemas/libros.schema";
import {  Duplicated } from './errors'

import { BaseModel } from "./base.model";
import { LibroPersona } from "./libro_persona.model";
import { PersonaLibroPersonaSchema, tipoPersona } from "../schemas/libro_persona.schema";

export class Libro extends BaseModel{
    static table_name = "libros";
    static fields = ["titulo", "isbn", "fecha_edicion", "precio", "stock"];
    static pk = ["isbn"];

    titulo: string;
    isbn: string;
    fecha_edicion: Date;
    precio: number;
    stock: number;
    user: number;

    constructor(request: LibroSchema) {
        super();

        this.titulo = request.titulo;
        this.isbn   = request.isbn;
        this.fecha_edicion = request.fecha_edicion;
        this.precio = request.precio;
        this.stock  = request.stock || 0
        this.user = request.user;
    }

    static async getByIsbn(isbn: string, userId: number): Promise<Libro> {
        return await super.find_one<LibroSchema, Libro>({isbn: isbn, is_deleted: 0, user: userId})
    }
    static async getAll(userId: number, req?: Partial<LibroSchema> | Partial<LibroSchema>[]): Promise<LibroSchema[]>{        
        if (req && Array.isArray(req)){
            return await super._bulk_select<LibroSchema>(req);
        }
        return await super.find_all<LibroSchema>({...req, is_deleted: 0, user: userId})
    }
    static async insert(body: LibroSchema): Promise<Libro> {
        return await super._insert<LibroSchema, Libro>(body);
    }

    static async is_duplicated(isbn: string){
        const exists = await super._exists({isbn: isbn, is_deleted: 0});
        if (exists){
            throw new Duplicated(`El libro con isbn ${isbn} ya existe`);
        }
    }
    
    async update(body: UpdateLibro, userId: number){
        await Libro._update(body, {isbn: this.isbn, is_deleted: 0, user: userId});

        for (let i in body){
            let value = body[i as keyof typeof body];
            if (value !== undefined)
                (this as any)[i] = value; 
        }
    }

    async updateStock(cantidad: number, userId: number){
        const query = `
            UPDATE ${Libro.table_name}
            SET stock = stock + ${cantidad}
            WHERE isbn = ?
            AND user = ?`

        const [result] = await conn.query<OkPacket>(query, [this.isbn, userId]);
        return result;
    }
    static async updateStock(isbn: string, cantidad: number, userId: number){
        const query = `
            UPDATE ${Libro.table_name}
            SET stock = stock + ${cantidad}
            WHERE isbn = ?
            AND user = ?`

        const [result] = await conn.query<OkPacket>(query, [isbn, userId]);
        return result;
    }

    static async delete(isbn: string, userId: number){
        await LibroPersona._delete({isbn: isbn});
        await super._update({is_deleted: 1}, {isbn: isbn, user: userId});
    }

    static async getVentas(isbn: string, userId: number){
        const [ventas] = await conn.query<RowDataPacket[]>(`
            SELECT  
                ventas.id as id_venta, fecha, medio_pago, total, file_path,
                id_cliente
            FROM libros_ventas
            INNER JOIN ventas
                ON ventas.id = libros_ventas.id_venta
            WHERE libros_ventas.isbn = ?
            AND ventas.user = ?
        `, [isbn, userId]);

        return ventas;
    }

    static async getPaginated(page = 0, userId: number): Promise<LibroSchema[]>{
        const libros_per_page = 10;
        const query = `
            SELECT ${this.fields.join(',')}
            FROM ${this.table_name}
            WHERE is_deleted = 0
            AND user = ?
            LIMIT ${libros_per_page}
            OFFSET ${page * libros_per_page}`

        const [libros] = await conn.query<RowDataPacket[]>(query, [userId]);
        return libros as LibroSchema[];
    }

    async getPersonas(userId: number){
        const query = `
            SELECT personas.id, dni, nombre, email, libros_personas.tipo, libros_personas.porcentaje
            FROM personas 
            INNER JOIN libros_personas
                ON personas.id  = libros_personas.id_persona
            WHERE isbn = ?
            AND personas.user = ?`

        const [personas] = await conn.query<RowDataPacket[]>(query, [this.isbn, userId]);
        return {
            autores: personas.filter(p => p.tipo == tipoPersona.autor) as PersonaLibroPersonaSchema[],
            ilustradores: personas.filter(p => p.tipo == tipoPersona.ilustrador) as PersonaLibroPersonaSchema[]
        };
    }
}
