import {conn} from "../db";
import { RowDataPacket } from "mysql2/promise";
import { NotFound } from './errors';

import { BaseModel } from "./base.model";

import { CreateLiquidacion, LiquidacionSchema, SaveLiquidacion } from "../schemas/liquidacion.schema";
import { TipoPersona } from "../schemas/libro_persona.schema";

export class Liquidacion extends BaseModel{
    static table_name = "liquidaciones";
    static fields = ["id", "isbn", "fecha_inicial", "fecha_final", "total", "file_path"];
    static clave = ["id", "isbn", "id_persona", "tipo_persona"];

    id: number;
    isbn: string;
    id_persona: number;
    tipo_persona: TipoPersona;

    fecha_inicial: Date;
    fecha_final: Date;
    total: number;
    file_path: string;

    constructor(body: LiquidacionSchema){
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

    static async insert(body: SaveLiquidacion): Promise<Liquidacion>{
        return await super._insert<SaveLiquidacion, Liquidacion>(body);
    }
    static async getAll(userId: number){
        return await super.find_all<LiquidacionSchema>({user: userId});
    }
    static async getOne(id: number, userId: number): Promise<Liquidacion>{
        return await super.find_one<LiquidacionSchema, Liquidacion>({id: id, user: userId})
    }

    static async valid_period(fecha_inicial: Date, fecha_final: Date, userId: number): Promise<boolean>{
        const query = `
            SELECT id FROM ${this.table_name}
            WHERE 
                (? > fecha_final)
                OR
                (? < fecha_inicial)
            AND user = ?`

        const [rows] = await conn.query<RowDataPacket[]>(query, [fecha_inicial, fecha_final, userId]);
        return rows.length <= 0;
    }

    static async getVentas(body: CreateLiquidacion, userId: number){
       const query = `
            SELECT * 
            FROM libros_ventas AS LV
            INNER JOIN ventas AS V
                ON V.id = LV.id_venta
            WHERE LV.isbn = ?
            AND V.fecha > ?
            AND V.fecha < ?
            AND V.user = ?` 

        const [rows] = await conn.query<RowDataPacket[]>(query, [body.isbn, body.fecha_inicial, body.fecha_final, userId]);

        if (rows.length <= 0){
            throw new NotFound(`No hay ninguna venta para el libro ${body.isbn} en el periodo`);
        }

        return rows;
    }

    async get_details(){
        const query = `
            SELECT id_venta, id_cliente, cantidad, precio_venta, V.file_path, fecha, descuento, medio_pago
            FROM libros_ventas AS LV
            INNER JOIN ventas AS V
                ON V.id = LV.id_venta
            WHERE LV.isbn = ?
            AND V.fecha < ?
            AND V.fecha > ?`

        const [rows] = await conn.query<RowDataPacket[]>(query, [this.isbn, this.fecha_final, this.fecha_inicial]);

        if (rows.length <= 0){
            throw new NotFound(`No hay ninguna venta para el libro ${this.isbn} en el periodo seleccionado`);
        }
        
        return rows;
    }
}

