import {conn} from '../db'
import { OkPacket, RowDataPacket } from "mysql2/promise";
import { NotFound, NothingChanged } from './errors';

export class BaseModel{
    /*
        DECLARATIONS
    */
    static table_name: string;
    static fields?: string[];
    /*
        IMPLEMENTATIONS
    */
    protected static format_where(req: object | undefined){
        let where_query = "";
        let where_list: any[] = []
        if (req){
            type key = keyof typeof req;
            where_query = "WHERE ";
            for (let field in req){ 
                where_query += `${field} = ? AND `;
                where_list.push(req[field as key]);
            }
            where_query = where_query.substring(0, where_query.length-4);
            console.log(where_query);
            console.log(where_list);
        }

        return {
            where_query: where_query,
            where_list: where_list
        }
    }

    protected static async _exists(req?: object): Promise<boolean>{
        let {where_query, where_list} = this.format_where(req);

        const query = `
            SELECT COUNT(*) AS count
            FROM ${this.table_name}
            ${where_query}`;

        console.log(query);

        const [rows] = await conn.query<RowDataPacket[]>(query, where_list);
        return rows[0].count > 0;
    }

    protected static async find_one<RT, MT>(req?: object): Promise<MT>{
        let {where_query, where_list} = this.format_where(req);
        
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
        let {where_query, where_list} = this.format_where(req);

        const query = `
            SELECT ${this.fields ? this.fields.join(',') : "*"} 
            FROM ${this.table_name}
            ${where_query}`;

        const [rows] = await conn.query<RowDataPacket[]>(query, where_list);
        return rows as RT[];
    }

    protected static async _insert<CT, MT>(_req: CT): Promise<MT>{
        const query = `INSERT INTO ${this.table_name} SET ?`;

        const [result] = await conn.query<OkPacket>(query, _req);

        return new (this as any)({
            ..._req,
            id: result.insertId            
        }) as MT;
    }

    protected static async _update<UT>(_req: UT, _where: object){        
        let {where_query, where_list} = this.format_where(_where);

        const query = `
            UPDATE ${this.table_name}
            SET ?
            ${where_query}`

        const [result] = await conn.query<OkPacket>(query, [_req].concat(where_list));

        if (result.affectedRows == 0)
            throw new NotFound(`No se encontro el item de la tabla ${this.table_name}`);

        if (result.changedRows == 0)
            throw new NothingChanged('Ningun valor es distinto a lo que ya existia en la base de datos');
    }

    protected static async _delete(_where: object){
        let {where_query, where_list} = this.format_where(_where);

        const query = `
            DELETE FROM ${this.table_name}
            ${where_query}`

        const [result] = await conn.query<OkPacket>(query, where_list);
        return result;
        //await this._update({is_deleted: 1}, _where);
    }

    protected static async _bulk_insert<CT extends {}>(_req: CT[]){
        if (_req.length == 0) return

        const keys = Object.keys(_req[0]).join(",");
        const parameters = _req.map(obj => `(${Object.values(obj).map(o => `?`)})`).join(","); // (?, ?, ?, ...),  (?, ?, ?, ...), ...
        const value_list = _req.map(obj => Object.values(obj)).flat();

        const query = `
            INSERT INTO ${this.table_name} (${keys})
            VALUES ${parameters}`;

        const [result] = await conn.query<OkPacket>(query, value_list);
    }

    protected static async _bulk_select<RT extends {}>(_req: object[]): Promise<RT[]>{
        if (_req.length == 0) return [] as RT[];

        const keys = Object.keys(_req[0]).join(",");
        const values = _req.map(obj => `(${Object.values(obj).join(",")})`).join(",");

        const query = `
            SELECT ${this.fields ? this.fields.join(',') : "*"} 
            FROM ${this.table_name} 
            WHERE (${keys}) IN (${values})`

        const [rows] = await conn.query<RowDataPacket[]>(query, _req);
        return rows as RT[];
    }

    /**
     * 
     * @param _req 
     * @returns
     *  return true if all objects exists in the db \
     *  return false if any object not exists
     */
    static async all_exists<RT extends {}>(_req: RT[]): Promise<boolean>{
        const rows = await this._bulk_select(_req);
        return rows.length == _req.length;
            throw new NotFound(`El item de la tabla ${this.table_name} no se encontro`);
    }

    /**
     * 
     * @param _req 
     * @returns
     *  return true if any objects exists in the db \
     *  return false if all the object not exists
     */
    static async any_exists<RT extends {}>(_req: RT[]): Promise<boolean>{
        const rows = await this._bulk_select(_req);
        console.log("ROWS: ", rows);
        
        return rows.length > 0;
    }

    protected static async _bulk_remove<DT extends {}>(_req: DT[]){
        if (_req.length == 0) return

        const keys = Object.keys(_req[0]).join(",");
        const values = _req.map(obj => `(${Object.values(obj).join(",")})`).join(",");

        const query = `
            DELETE FROM ${this.table_name}
            WHERE (${keys}) in (${values})`;

        const [rows] = await conn.query<OkPacket>(query);

        if (rows.affectedRows == 0)
            throw new NotFound(`No se encontró ningun item de la tabla ${this.table_name} para eliminar`);
    }
}
