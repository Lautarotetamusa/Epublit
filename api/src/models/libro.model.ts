import { conn } from "../db"
import { OkPacket, RowDataPacket } from "mysql2/promise";
import { LibroSchema, UpdateLibro } from "../schemas/libros.schema";
import {  Duplicated } from './errors'

import { BaseModel } from "./base.model";
import { LibroPersona } from "./libro_persona.model";
import { LibroPersonaSchema, tipoPersona } from "../schemas/libro_persona.schema";

export class Libro extends BaseModel{
    static table_name = "libros";
    static fields = ["titulo", "isbn", "fecha_edicion", "precio", "stock"];
    static pk = ["isbn"];

    titulo: string;
    isbn: string;
    fecha_edicion: Date;
    precio: number;
    stock: number;

    constructor(request: LibroSchema) {
        super();

        this.titulo = request.titulo;
        this.isbn   = request.isbn;
        this.fecha_edicion = request.fecha_edicion;
        this.precio = request.precio;
        this.stock  = request.stock || 0
    }

    static async get_by_isbn(isbn: string): Promise<Libro> {
        return await super.find_one<LibroSchema, Libro>({isbn: isbn, is_deleted: 0})
    }
    static async get_all(): Promise<LibroSchema[]>{        
        return await super.find_all<LibroSchema>({is_deleted: 0})
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
    
    async update(body: UpdateLibro){
        await Libro._update(body, {isbn: this.isbn, is_deleted: 0});

        for (let i in body){
            let value = body[i as keyof typeof body];
            if (value !== undefined)
                (this as any)[i] = value; 
        }
    }

    async update_stock(qty: number){
        const query = `
            UPDATE ${Libro.table_name}
            SET stock = stock + ${qty}
            WHERE isbn = ?`

        const [result] = await conn.query<OkPacket>(query, [this.isbn]);
        return result;
    }

    static async delete(isbn: string){
        await LibroPersona._delete({isbn: isbn});

        await super._update({is_deleted: 1}, {isbn: isbn});
    }

    static async get_ventas(isbn: string){
        const [ventas] = await conn.query<RowDataPacket[]>(`
            SELECT  
                ventas.id as id_venta, fecha, medio_pago, total, file_path,
                id_cliente
            FROM libros_ventas
            INNER JOIN ventas
                ON ventas.id = libros_ventas.id_venta
            WHERE libros_ventas.isbn = ?
        `, [isbn]);

        return ventas;
    }

    static async get_paginated(page = 0): Promise<LibroSchema[]>{
        const libros_per_page = 10;
        const query = `
            SELECT ${this.fields.join(',')}
            FROM ${this.table_name}
            WHERE is_deleted = 0
            LIMIT ${libros_per_page}
            OFFSET ${page * libros_per_page}`

        const [libros] = await conn.query<RowDataPacket[]>(query);
        return libros as LibroSchema[];
    }

    async get_personas(): Promise<{autores: LibroPersonaSchema[], ilustradores: LibroPersonaSchema[]}>{
        const query = `
            SELECT personas.id, dni, nombre, email, libros_personas.tipo, libros_personas.porcentaje
            FROM personas 
            INNER JOIN libros_personas
                ON personas.id  = libros_personas.id_persona
            WHERE isbn = ?`

        const [personas] = await conn.query<RowDataPacket[]>(query, [this.isbn]);
        return {
            autores: personas.filter(p => p.tipo == tipoPersona.autor) as LibroPersonaSchema[],
            ilustradores: personas.filter(p => p.tipo == tipoPersona.ilustrador) as LibroPersonaSchema[]
        };
    }
}
