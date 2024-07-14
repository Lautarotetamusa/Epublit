import { RowDataPacket, PoolConnection } from "mysql2/promise";
import { conn } from "../db"
import { BaseModel } from "./base.model";
import { CreateLibroPrecio } from "../schemas/libros.schema";

export class LibroPrecio extends BaseModel{
    static table_name = "precio_libros";
    static fields = ["isbn", "precio", "created_at"];

    static async insert(body: CreateLibroPrecio, connection?: PoolConnection){
        if (connection === undefined){
            connection = await conn.getConnection();
        }

        try{
            const l = await this._insert<CreateLibroPrecio, LibroPrecio>(body, connection);
            connection.release();
            return l;
        }catch(e){
            connection.release();
            throw e;
        }
    }

    static async getPreciosLibro(isbn: string){
        const query = `
            SELECT ${this.fields.join(',')}
            FROM ${this.table_name}
            WHERE isbn = ?
            ORDER BY id DESC
        `;
        const [rows] = await conn.query<RowDataPacket[]>(query, [isbn]);
        return rows;
    }

    static getPrecioLibroFecha(isbn: string, date: Date){
        const query = `
            SELECT * 
                FROM ${this.table_name} 
            WHERE isbn = ?
            AND ? < created_at
            ORDER BY id DESC`;

        return conn.query(query, [isbn, date]);
    }
};

