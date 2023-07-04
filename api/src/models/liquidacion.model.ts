import {conn} from "../db";
import { OkPacket, RowDataPacket } from "mysql2/promise";
import { ValidationError, NotFound, NothingChanged, Duplicated } from './errors';

import { retrieveLiquidacion, createLiquidacion } from "../schemas/liquidacion.schema";

import { Libro } from "../models/libro.model";
import { Venta } from "../models/venta.model";

const table_name = "liquidaciones";

export class Liquidacion{
    id: number;
    isbn: string;
    fecha_inicial: Date;
    fecha_final: Date;
    total: number;
    file_path: string;

    libro?: Libro;
    ventas?: Venta[];

    constructor(_liq: retrieveLiquidacion){
        this.id = _liq.id;
        this.isbn = _liq.isbn;
        this.fecha_inicial = _liq.fecha_inicial;
        this.fecha_final = _liq.fecha_final;
        this.total = _liq.total;
        this.file_path =  _liq.file_path;
    }

    static async check_period(fecha_inicial: Date, fecha_final: Date): Promise<boolean>{
        const query = `
            SELECT id FROM ${table_name}
            WHERE 
                (fecha_inicial < ? AND fecha_inicial > ?)
                OR 
                (fecha_final < ? AND fecha_final > ?)`

        const [rows] = await conn.query<RowDataPacket[]>(query, [fecha_final, fecha_inicial, fecha_final, fecha_inicial]);

        return rows.length > 0;
    }

    static async get_ventas(_liq: createLiquidacion) {
       const query = `
            SELECT * FROM libros_ventas AS LV
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

    static async insert(_liq: retrieveLiquidacion): Promise<Liquidacion>{
        const query = `INSERT INTO ${table_name} SET ?`;

        const [result] = await conn.query<OkPacket>(query, _liq);

        return new Liquidacion({
            ..._liq,
            id: result.insertId            
        })
    }

    static async get_all(){
        const query = `SELECT * FROM ${table_name}`;

        const [rows] = await conn.query<RowDataPacket[]>(query);

        return rows;
    }

    static async get_one(id: number): Promise<Liquidacion>{
        const query = `
            SELECT * FROM ${table_name}
            WHERE id = ?`;
        const [rows] = await conn.query<RowDataPacket[]>(query, [id]);

        if (rows.length > 0)
            throw new NotFound(`No se encontro la liquidacion con id ${id}`)

        return new Liquidacion(rows[0] as retrieveLiquidacion);
    }

    async get_details(){
        const query = `
            SELECT * FROM Liquidacion AS Liq

            INNER JOIN libros_ventas AS LV
                    ON LV.isbn = Libro.isbn
            INNER JOIN ventas AS V
                    ON V.id = LV.id_venta

            AND V.fecha < Liq.fecha_final
            AND V.fecha > Liq.fecha_inicial
            WHERE Liq.id = ?`;

        const [rows] = await conn.query<RowDataPacket[]>(query, [this.id]);

        if (rows.length <= 0)
            throw new NotFound(`No hay ninguna venta para el libro ${this.isbn} en el periodo seleccionado`);
        
        return rows;
    }
}

