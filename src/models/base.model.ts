import {conn} from '../db'

import { ResultSetHeader, RowDataPacket, PoolConnection } from "mysql2/promise";

import { NotFound, ValidationError } from './errors';

import assert from 'assert';

function formatWhere(req: object | undefined){
    type key = keyof typeof req;

    let where_query = "";
    const where_list: typeof req[key][] = []

    if (req && Object.keys(req).length > 0){
        where_query = "WHERE ";
        for (const field in req){ 
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
    
    protected static async _exists(req?: object): Promise<boolean>{
        const {where_query, where_list} = formatWhere(req);

        const query = `
            SELECT COUNT(*) AS count
            FROM ${this.table_name}
            ${where_query}`;

        const [rows] = await conn.query<RowDataPacket[]>(query, where_list);
        return rows[0].count > 0;
    }

    protected static async find_one<RT, MT>(req?: object): Promise<MT>{
        const {where_query, where_list} = formatWhere(req);
        
        const query = `
            SELECT ${this.fields ? this.fields.join(',') : "*"}
            FROM ${this.table_name}
            ${where_query}`;

        const [rows] = await conn.query<RowDataPacket[]>(query, where_list);

        if (rows.length <= 0){
            throw new NotFound(`No se encontro el item de la tabla ${this.table_name}`);
        }

        return new (this as any)(rows[0] as RT) as MT; 
    }

    protected static async find_all<RT>(req?: object): Promise<RT[]>{
        const {where_query, where_list} = formatWhere(req);

        const query = `
            SELECT ${this.fields ? this.fields.join(',') : "*"} 
            FROM ${this.table_name}
            ${where_query}`;

        const [rows] = await conn.query<RowDataPacket[]>(query, where_list);
        return rows as RT[];
    }

    protected static async _insert<CT, MT>(req: CT, connection?: PoolConnection): Promise<MT>{
        if (connection === undefined){
            connection = await conn.getConnection();
        }

        const query = `INSERT INTO ${this.table_name} SET ?`;

        try {
            const [result] = await connection.query<ResultSetHeader>(query, req);
            connection.release();

            const model = new (this as any)(req) as MT;
            if (this.pk){
                model[this.pk as keyof typeof model] = result.insertId as any;
            }

            return model;
        } catch (error: any) {
            connection.release();

            if ('code' in error && error.code == "ER_DUP_ENTRY"){
                throw new ValidationError(`Ya existe una ${this.table_name} con esta clave`);
            }
            throw new Error(error.message);
        }
    }

    protected static async _update<UT>(req: UT, where: object, connection?: PoolConnection){        
        if (connection === undefined){
            connection = await conn.getConnection();
        }

        const {where_query, where_list} = formatWhere(where);

        const query = `
            UPDATE ${this.table_name}
            SET ?
            ${where_query}`

        try{
            const [result] = await connection.query<ResultSetHeader>(query, [req].concat(where_list));

            if (result.affectedRows == 0){
                throw new NotFound(`No se encontro el item de la tabla ${this.table_name}`);
            }

            connection.release();
            return result;
        }catch(e){
            connection.release();
            throw e;
        }
    }

    protected static async _delete(where: object, connection?: PoolConnection){
        if (connection === undefined){
            connection = await conn.getConnection();
        }
        const {where_query, where_list} = formatWhere(where);

        const query = `
            DELETE FROM ${this.table_name}
            ${where_query}`

        try{
            const [result] = await connection.query<ResultSetHeader>(query, where_list);
            connection.release();
            return result;
        }catch(e){
            connection.release();
            throw e;
        }
    }

    /**
     * 
     * @param req 
     * @returns
     *  return true if all objects exists in the db \
     *  return false if any object not exists
     */
    static async all_exists<RT extends object>(req: RT[]): Promise<boolean>{
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
    static async any_exists<RT extends object>(req: RT[]): Promise<boolean>{
        const rows = await this._bulk_select(req);
        return rows.length > 0;
    }

    protected static async _bulk_insert<CT extends object>(req: CT[], connection?: PoolConnection){
        if (connection === undefined){
            connection = await conn.getConnection();
        }
        if (req.length == 0) return;

        const keys = Object.keys(req[0]).join(",");
        const parameters = req.map(obj => `(${Object.values(obj).fill('?')})`).join(","); // (?, ?, ?, ...),  (?, ?, ?, ...), ...
        const value_list = req.map(obj => Object.values(obj)).flat();

        const query = `
            INSERT INTO ${this.table_name} (${keys})
            VALUES ${parameters}`;

        try{
            const [result] = await connection.query<ResultSetHeader>(query, value_list);
            connection.release();
            return result;
        }catch(e){
            connection.release();
            throw e;
        }
    }

    protected static async _bulk_select<RT extends object>(req: object[]): Promise<RT[]>{
        if (req.length == 0) return [] as RT[];
        if ((typeof req[0]) != 'object') return [] as RT[];

        const keys = Object.keys(req[0]).join(",");
        const parameters = req.map(obj => `(${Object.values(obj).fill('?')})`).join(","); // (?, ?, ?, ...),  (?, ?, ?, ...), ...
        const value_list = req.map(obj => Object.values(obj)).flat();

        assert(value_list.length > 0, "El value es vacio");

        const query = `
            SELECT ${this.fields ? this.fields.join(',') : "*"} 
            FROM ${this.table_name} 
            WHERE (${keys}) IN (${parameters})`;

        const [rows] = await conn.query<RowDataPacket[]>(query, value_list);
        return rows as RT[];
    }

    protected static async _bulk_remove<DT extends object>(req: DT[], connection?: PoolConnection){
        if (connection === undefined){
            connection = await conn.getConnection();
        }
        if (req.length == 0) return [] as DT[];
        if ((typeof req[0]) != 'object') return [] as DT[];

        const keys = Object.keys(req[0]).join(",");
        const parameters = req.map(obj => `(${Object.values(obj).fill('?')})`).join(","); // (?, ?, ?, ...),  (?, ?, ?, ...), ...
        const valueList  = req.map(obj => Object.values(obj)).flat();

        assert(valueList.length > 0, "El value es vacio");

        const query = `
            DELETE FROM ${this.table_name}
            WHERE (${keys}) in (${parameters})`;

        try{
            const [res] = await connection.query<ResultSetHeader>(query, valueList);
            connection.release();

            if (res.affectedRows == 0){
                throw new NotFound(`No se encontró ningun item de la tabla ${this.table_name} para eliminar`);
            }
            return res;
        }catch(e){
            connection.release();
            throw e;
        }
    }
}
