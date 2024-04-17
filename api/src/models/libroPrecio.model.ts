import { RowDataPacket } from "mysql2";
import { conn } from "../db"
import { BaseModel } from "./base.model";

export class LibroPrecio extends BaseModel{
    static table_name = "precio_libros";
    static fields = ["isbn", "precio", "created_at"];

    static insert(isbn: string, precio: number, userId: number){
        return this._insert({precio: precio, isbn: isbn, user: userId});
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

