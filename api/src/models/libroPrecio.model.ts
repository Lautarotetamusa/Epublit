import { RowDataPacket } from "mysql2";
import { conn } from "../db"
import { BaseModel, DBConnection } from "./base.model";
import { CreateLibroPrecio } from "../schemas/libros.schema";

export class LibroPrecio extends BaseModel{
    static table_name = "precio_libros";
    static fields = ["isbn", "precio", "created_at"];

    static insert(body: CreateLibroPrecio, connection: DBConnection){
        return this._insert<CreateLibroPrecio, LibroPrecio>(body, connection);
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

