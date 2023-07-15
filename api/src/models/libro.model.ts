import {conn} from "../db"
import { RowDataPacket } from "mysql2/promise";
import { retrieveLibro, saveLibro, updateLibro } from "../schemas/libros.schema";
import { TipoPersona, createPersonaLibroInDB, removePersonaLibro, updateLibroPersona } from "../schemas/libro_persona.schema";
import {  Duplicated } from './errors'

import { BaseModel } from "./base.model";
import { retrieveLibroPersona } from "../schemas/libro_persona.schema";
import { LibroPersona } from "./libro_persona.model";

const table_name = "libros"
const visible_fields = "titulo, isbn, fecha_edicion, precio, stock"

export class Libro extends BaseModel{
    titulo: string;
    isbn: string;
    fecha_edicion: Date;
    precio: number;
    stock: number;

    static table_name = "libros";
    static fields = ["titulo", "isbn", "fecha_edicion", "precio", "stock"];

    constructor(request: retrieveLibro) {
        super();

        this.titulo = request.titulo;
        this.isbn   = request.isbn;
        this.fecha_edicion = request.fecha_edicion;
        this.precio = request.precio;
        this.stock  = request.stock || 0
    }

    static async get_by_isbn(isbn: string): Promise<Libro> {
        return await super.find_one<retrieveLibro, Libro>({isbn: isbn, is_deleted: 0})
    }
    static async get_all(): Promise<retrieveLibro[]>{        
        return await super.find_all<retrieveLibro>({is_deleted: 0})
    }
    static async insert(_req: saveLibro): Promise<Libro> {
        return await super._insert<saveLibro, Libro>(_req);
    }

    static async is_duplicated(isbn: string){
        const exists = await super._exists({isbn: isbn, is_deleted: 0});
        if (exists)
            throw new Duplicated(`El libro con isbn ${isbn} ya existe`);
    }
    
    async update(_req: updateLibro){
        await Libro._update(_req, {isbn: this.isbn, is_deleted: 0});

        for (let i in _req){
            let value = _req[i as keyof typeof _req];
            if (value !== undefined)
                (this as any)[i] = value; 
        }
    }

    async update_stock(stock: number){
        await this.update({stock: this.stock+stock})
    }

    static async delete(isbn: string){
        await conn.query(`
            DELETE FROM libros_personas
            WHERE isbn = ?
        `, [isbn]);

        await super._delete({isbn: isbn});
    }

    static async get_ventas(isbn: string): Promise<any>{
        const [ventas] = await conn.query<RowDataPacket[]>(`
            SELECT  
                ventas.id as id_venta, fecha, medio_pago, total, file_path,
                id_cliente
            FROM libros_ventas
            INNER JOIN ventas
                ON ventas.id = libros_ventas.id_venta
            WHERE libros_ventas.isbn = ${isbn}
        `);

        return ventas;
    }

    static async get_paginated(page = 0): Promise<retrieveLibro[]>{
        let libros_per_page = 10;
        const query = `
            SELECT ${visible_fields}
            FROM ${table_name}
            WHERE is_deleted = 0
            LIMIT ${libros_per_page}
            OFFSET ${page * libros_per_page}`

        const [libros] = await conn.query<RowDataPacket[]>(query);
        return libros as retrieveLibro[];
    }

    async get_personas(): Promise<{autores: retrieveLibroPersona[], ilustradores: retrieveLibroPersona[]}>{
        const query = `
            SELECT personas.id, dni, nombre, email, libros_personas.tipo, libros_personas.porcentaje
            FROM personas 
            INNER JOIN libros_personas
            INNER JOIN ${table_name}
                ON personas.id  = libros_personas.id_persona
                AND ${table_name}.isbn = libros_personas.isbn
            WHERE ${table_name}.isbn = ?
            AND ${table_name}.is_deleted = 0`

        const [personas] = await conn.query<RowDataPacket[]>(query, [this.isbn]);
        return {
            autores: personas.filter(p => p.tipo == TipoPersona.autor) as retrieveLibroPersona[],
            ilustradores: personas.filter(p => p.tipo == TipoPersona.ilustrador) as retrieveLibroPersona[]
        };
    }

    async add_personas(personas: createPersonaLibroInDB[]){
        await LibroPersona.insert(personas);
    }

    async update_personas(personas: updateLibroPersona[]){
        await LibroPersona.update(personas);
    }
    
    async remove_personas(personas: removePersonaLibro[]){
        await LibroPersona.remove(personas);
    }
}
