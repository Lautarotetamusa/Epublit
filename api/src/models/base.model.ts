import {conn} from '../db'

import { RowDataPacket } from "mysql2/promise";
import { ResultSetHeader } from "mysql2";

import { NotFound, ValidationError } from './errors';

import assert from 'assert';

export interface DBConnection{
    query<T>(sql: string, value: any): Promise<T>;
}

type Where<Schema> = Partial<{ 
    [K in keyof Schema]: 
        Schema[K] | 
        Schema[K][] |
        {
            equal: Schema[K],
        } | {
            less: Schema[K]
        } | {
            greater: Schema[K]
        }
}>;

export class BaseModel{
    /*
        DECLARATIONS
    */
    static table_name: string;
    static fields?: string[];
    static pk: string = "id";
    /*
        IMPLEMENTATIONS
    */
    protected static formatWhere(req: object | undefined){
        let where_query = "";
        let where_list: any[] = []
        if (req && Object.keys(req).length > 0){
            type key = keyof typeof req;
            where_query = "WHERE ";
            for (let field in req){ 
                where_query += `${field} = ? AND `;
                where_list.push(req[field as key]);
            }
            where_query = where_query.substring(0, where_query.length-4);
        }

        return {
            where_query: where_query,
            where_list: where_list
        }
    }

    /*
    protected formatWhereImproved<Schema extends object>(req: Where<Schema>){
        let whereQuery = "";
        let whereList: any[] = [];

        if (req && Object.keys(req).length > 0){
            whereQuery = "WHERE ";

            for (let key in req){ 
                const field = req[key as keyof typeof req];

                if (Array.isArray(field)){
                    const values = field.join(', ');
                    whereQuery += `(${key}) IN (${values}) AND `;
                }else{
                    if (field.less){

                    }
                    whereQuery += `${key} = ? AND `;
                    whereList.push(field);
                }
            }
            whereQuery = whereQuery.substring(0, whereQuery.length-4);
        }

        return {
            whereQuery: whereQuery,
            whereList: whereList
        }
    }
    */
    
    protected static async _exists(req?: object): Promise<boolean>{
        let {where_query, where_list} = this.formatWhere(req);

        const query = `
            SELECT COUNT(*) AS count
            FROM ${this.table_name}
            ${where_query}`;

        const [rows] = await conn.query<RowDataPacket[]>(query, where_list);
        return rows[0].count > 0;
    }

    protected static async find_one<RT, MT>(req?: object): Promise<MT>{
        let {where_query, where_list} = this.formatWhere(req);
        
        const query = `
            SELECT ${this.fields ? this.fields.join(',') : "*"}
            FROM ${this.table_name}
            ${where_query}`;

        const [rows] = await conn.query<RowDataPacket[]>(query, where_list);

        if (rows.length <= 0)
            throw new NotFound(`No se encontro el item de la tabla ${this.table_name}`);

        return new (this as any)(rows[0] as RT) as MT; 
    }

    protected static async find_all<RT>(req?: object): Promise<RT[]>{
        let {where_query, where_list} = this.formatWhere(req);

        const query = `
            SELECT ${this.fields ? this.fields.join(',') : "*"} 
            FROM ${this.table_name}
            ${where_query}`;

        const [rows] = await conn.query<RowDataPacket[]>(query, where_list);
        return rows as RT[];
    }

    protected static async _insert<CT, MT>(req: CT, connection: DBConnection = conn): Promise<MT>{
        const query = `INSERT INTO ${this.table_name} SET ?`;
        console.log("connection:", connection);

        try {
            const [result] = await connection.query<ResultSetHeader[]>(query, req);

            const model = new (this as any)(req) as MT;
            if (this.pk){
                model[this.pk as keyof typeof model] = result.insertId as any;
            }
            return model;
        } catch (error: any) {
            if ('code' in error && error.code == "ER_DUP_ENTRY")
                throw new ValidationError(`Ya existe una ${this.table_name} con esta clave`);
            throw new Error(error.message);
        }
    }

    protected static async _update<UT>(req: UT, where: object, connection: DBConnection = conn){        
        let {where_query, where_list} = this.formatWhere(where);

        const query = `
            UPDATE ${this.table_name}
            SET ?
            ${where_query}`

        const [result] = await connection.query<ResultSetHeader[]>(query, [req].concat(where_list));

        if (result.affectedRows == 0){
            throw new NotFound(`No se encontro el item de la tabla ${this.table_name}`);
        }
    }

    protected static async _delete(where: object, connection: DBConnection = conn){
        let {where_query, where_list} = this.formatWhere(where);

        const query = `
            DELETE FROM ${this.table_name}
            ${where_query}`

        const [result] = await connection.query<ResultSetHeader[]>(query, where_list);
        return result;
    }

    /**
     * 
     * @param req 
     * @returns
     *  return true if all objects exists in the db \
     *  return false if any object not exists
     */
    static async all_exists<RT extends {}>(req: RT[]): Promise<boolean>{
        const rows = await this._bulk_select(req);
        return rows.length == req.length;
    }

    /**
     * 
     * @param req 
     * @returns
     *  return true if any objects exists in the db \
     *  return false if all the object not exists
     */
    static async any_exists<RT extends {}>(req: RT[]): Promise<boolean>{
        const rows = await this._bulk_select(req);
        return rows.length > 0;
    }

    protected static async _bulk_insert<CT extends {}>(req: CT[], connection: DBConnection = conn){
        if (req.length == 0) return

        const keys = Object.keys(req[0]).join(",");
        const parameters = req.map(obj => `(${Object.values(obj).map(o => `?`)})`).join(","); // (?, ?, ?, ...),  (?, ?, ?, ...), ...
        const value_list = req.map(obj => Object.values(obj)).flat();

        const query = `
            INSERT INTO ${this.table_name} (${keys})
            VALUES ${parameters}`;

        const [result] = await connection.query<ResultSetHeader[]>(query, value_list);
        return result;
    }

    protected static async _bulk_select<RT extends {}>(req: object[]): Promise<RT[]>{
        if (req.length == 0) return [] as RT[];
        if ((typeof req[0]) != 'object') return [] as RT[];

        const keys = Object.keys(req[0]).join(",");
        const parameters = req.map(obj => `(${Object.values(obj).map(o => `?`)})`).join(","); // (?, ?, ?, ...),  (?, ?, ?, ...), ...
        const value_list = req.map(obj => Object.values(obj)).flat();

        assert(value_list.length > 0, "El value es vacio");

        const query = `
            SELECT ${this.fields ? this.fields.join(',') : "*"} 
            FROM ${this.table_name} 
            WHERE (${keys}) IN (${parameters})`;

        const [rows] = await conn.query<RowDataPacket[]>(query, value_list);
        return rows as RT[];
    }

    protected static async _bulk_remove<DT extends {}>(req: DT[], connection: DBConnection = conn){
        if (req.length == 0) return [] as DT[];
        if ((typeof req[0]) != 'object') return [] as DT[];

        const keys = Object.keys(req[0]).join(",");
        const parameters = req.map(obj => `(${Object.values(obj).map(o => `?`)})`).join(","); // (?, ?, ?, ...),  (?, ?, ?, ...), ...
        const value_list = req.map(obj => Object.values(obj)).flat();

        assert(value_list.length > 0, "El value es vacio");

        const query = `
            DELETE FROM ${this.table_name}
            WHERE (${keys}) in (${parameters})`;

        const [rows] = await connection.query<ResultSetHeader[]>(query, value_list);

        if (rows.affectedRows == 0){
            throw new NotFound(`No se encontró ningun item de la tabla ${this.table_name} para eliminar`);
        }
    }
}
