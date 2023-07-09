import {conn} from "../db";
import { OkPacket, RowDataPacket } from "mysql2/promise";
import { NotFound } from './errors';

import { BaseModel } from "./base.model";

import { retrieveLiquidacion, createLiquidacion } from "../schemas/liquidacion.schema";

export class Liquidacion extends BaseModel{
    id: number;
    isbn: string;
    fecha_inicial: Date;
    fecha_final: Date;
    total: number;
    file_path: string;

    static table_name = "liquidaciones";
    static fields = ["id", "isbn", "fecha_inicial", "fecha_final", "total", "file_path"];

    constructor(_liq: retrieveLiquidacion){
        super();
        
        this.id = _liq.id;
        this.isbn = _liq.isbn;
        this.fecha_inicial = _liq.fecha_inicial;
        this.fecha_final = _liq.fecha_final;
        this.total = _liq.total;
        this.file_path =  _liq.file_path;
    }

    static async insert(_req: createLiquidacion): Promise<Liquidacion>{
        return await super._insert<createLiquidacion, Liquidacion>(_req);
    }
    static async get_all(){
        return await super.find_all<retrieveLiquidacion>({is_deleted: false});
    }
    static async get_one(id: number): Promise<Liquidacion>{
        return await super.find_one<retrieveLiquidacion, Liquidacion>({id: id, is_deleted: false})
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

    static async get_ventas(_liq: createLiquidacion){
       const query = `
            SELECT * 
            FROM libros_ventas AS LV
            INNER JOIN ventas AS V
                ON V.id = LV.id_venta
            WHERE LV.isbn = ?
            AND V.fecha > ?
            AND V.fecha < ?` 

        const [rows] = await conn.query<RowDataPacket[]>(query, [_liq.isbn, _liq.fecha_inicial, _liq.fecha_final]);

        if (rows.length <= 0)
            throw new NotFound(`No hay ninguna venta para el libro ${_liq.isbn} en el periodo`);

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

        if (rows.length <= 0)
            throw new NotFound(`No hay ninguna venta para el libro ${this.isbn} en el periodo seleccionado`);
        
        return rows;
    }
}

