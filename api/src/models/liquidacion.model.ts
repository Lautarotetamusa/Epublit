import {conn} from "../db";
import { RowDataPacket } from "mysql2/promise";
import { NotFound } from './errors';

import { BaseModel } from "./base.model";

import { retrieveLiquidacion, createLiquidacion, saveLiquidacion } from "../schemas/liquidacion.schema";
import { TipoPersona } from "../schemas/libro_persona.schema";

export class Liquidacion extends BaseModel{
    id: number;
    isbn: string;
    id_persona: number;
    tipo_persona: TipoPersona;

    fecha_inicial: Date;
    fecha_final: Date;
    total: number;
    file_path: string;

    static table_name = "liquidaciones";
    static fields = ["id", "isbn", "fecha_inicial", "fecha_final", "total", "file_path"];
    static pk = ["id", "isbn", "id_persona", "tipo_persona"];

    constructor(body: retrieveLiquidacion){
        super();
        
        this.id = body.id;
        this.isbn = body.isbn;
        this.id_persona = body.id_persona;
        this.tipo_persona = body.tipo_persona;

        this.fecha_inicial = body.fecha_inicial;
        this.fecha_final = body.fecha_final;
        this.total = body.total;
        this.file_path =  body.file_path;
    }

    static async insert(_req: saveLiquidacion): Promise<Liquidacion>{
        return await super._insert<saveLiquidacion, Liquidacion>(_req);
    }
    static async get_all(){
        return await super.find_all<retrieveLiquidacion>();
    }
    static async get_one(id: number): Promise<Liquidacion>{
        return await super.find_one<retrieveLiquidacion, Liquidacion>({id: id})
    }

    static async valid_period(fecha_inicial: Date, fecha_final: Date): Promise<boolean>{
        const query = `
            SELECT id FROM ${this.table_name}
            WHERE 
                (? > fecha_final)
                OR
                (? < fecha_inicial)`

        const [rows] = await conn.query<RowDataPacket[]>(query, [fecha_inicial, fecha_final]);
        return rows.length <= 0;
    }

    static async get_ventas(body: createLiquidacion){
       const query = `
            SELECT * 
            FROM libros_ventas AS LV
            INNER JOIN ventas AS V
                ON V.id = LV.id_venta
            WHERE LV.isbn = ?
            AND V.fecha > ?
            AND V.fecha < ?` 

        const [rows] = await conn.query<RowDataPacket[]>(query, [body.isbn, body.fecha_inicial, body.fecha_final]);

        if (rows.length <= 0){
            throw new NotFound(`No hay ninguna venta para el libro ${body.isbn} en el periodo`);
        }

        return rows;
    }

    async get_details(){
        const query = `
            SELECT id_venta, id_cliente, cantidad, precio_venta, V.file_path, fecha, descuento, medio_pago
            FROM ${Liquidacion.table_name} AS Liq

            INNER JOIN libros_ventas AS LV
                ON LV.isbn = ? 
            INNER JOIN ventas AS V
                ON V.id = LV.id_venta

            AND V.fecha < Liq.fecha_final
            AND V.fecha > Liq.fecha_inicial
            WHERE Liq.id = ?`;

        const [rows] = await conn.query<RowDataPacket[]>(query, [this.isbn, this.id]);

        if (rows.length <= 0){
            throw new NotFound(`No hay ninguna venta para el libro ${this.isbn} en el periodo seleccionado`);
        }
        
        return rows;
    }
}

