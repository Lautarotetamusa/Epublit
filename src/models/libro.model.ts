import { conn } from "../db"
import { ResultSetHeader, RowDataPacket, PoolConnection} from "mysql2/promise";
import { LibroSchema, SaveLibro, UpdateLibro } from "../schemas/libros.schema";
import {  Duplicated } from './errors'

import { BaseModel } from "./base.model";
import { LibroPersona } from "./libro_persona.model";
import { PersonaLibroPersonaSchema, tipoPersona } from "../schemas/libro_persona.schema";

export class Libro extends BaseModel{
    static table_name = "libros";
    static fields = ["id_libro", "titulo", "isbn", "fecha_edicion", "precio", "stock"];
    static pk = "id_libro";

    titulo: string;
    isbn: string;
    id_libro: number;
    fecha_edicion: Date;
    precio: number;
    stock: number;
    user: number;

    constructor(request: LibroSchema) {
        super();

        this.titulo = request.titulo;
        this.isbn   = request.isbn;
        this.id_libro = request.id_libro;
        this.fecha_edicion = request.fecha_edicion;
        this.precio = request.precio;
        this.stock  = request.stock || 0
        this.user = request.user;
    }

    static async getByIsbn(isbn: string, userId: number): Promise<Libro> {
        return await super.find_one<LibroSchema, Libro>({isbn: isbn, is_deleted: 0, user: userId})
    }

    static async getAll(userId: number, req?: object): Promise<LibroSchema[]>{        
        const libros = await Libro.find_all({
            ...req,
            is_deleted: false,
            user: userId
        });
        return libros as LibroSchema[];
    }

    static async insert(body: SaveLibro, connection?: PoolConnection): Promise<Libro> {
        return await Libro._insert<SaveLibro, Libro>(body, connection);
    }

    static async is_duplicated(isbn: string, userId: number){
        const exists = await super._exists({isbn: isbn, is_deleted: 0, user: userId});
        if (exists){
            throw new Duplicated(`El libro con isbn ${isbn} ya existe`);
        }
    }
    
    async update(body: UpdateLibro, userId: number, connection?: PoolConnection){
        await Libro._update(body, {isbn: this.isbn, is_deleted: 0, user: userId}, connection);

        for (const i in body){
            const value = body[i as keyof typeof body];
            if (value !== undefined){
                (this as any)[i] = value; 
            }
        }
    }

    static async updateStock(id_libro: number, cantidad: number, connection?: PoolConnection){
        if (connection === undefined){
            connection = await conn.getConnection();
        }
        const query = `
            UPDATE ${Libro.table_name}
            SET stock = stock + ${cantidad}
            WHERE id_libro = ?`

        try{
            const result = await connection.query<ResultSetHeader>(query, [id_libro]);
            return result;
        }catch(e){
            connection.release();
            throw e;
        }
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
            SELECT id_persona, dni, nombre, email, libros_personas.tipo, libros_personas.porcentaje
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
