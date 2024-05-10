import {conn} from '../db'
import { NotFound } from './errors';
import { DBConnection } from './base.model';
import { MedioPago, SaveVenta, VentaSchema } from '../schemas/venta.schema';
import { RowDataPacket } from 'mysql2';
import { LibroTransaccion, Transaccion } from './transaccion.model';
import { SaveTransaccion, TransaccionSchema, tipoTransaccion } from '../schemas/transaccion.schema';
import { filesUrl } from '../app';

export class Venta extends Transaccion{
    static table_name = 'ventas';
    static filesFolder = 'facturas';
    static pk = 'id_transaccion';
    static type = tipoTransaccion.venta;

    id_transaccion: number;
    descuento: number;
    medio_pago: MedioPago;
    total: number;

    punto_venta: number;
    tipo_cbte: number;

    constructor(request: VentaSchema & TransaccionSchema){
        super({
            type: tipoTransaccion.venta,
            id: request.id,
            fecha: request.fecha,
            id_cliente: request.id_cliente,
            file_path: request.file_path,
            user: request.user,
        });

        this.descuento   = request.descuento;
        this.punto_venta = 4;
        this.tipo_cbte   = request.tipo_cbte;

        this.medio_pago = request.medio_pago;
        this.total = request.total;
        this.id_transaccion = request.id_transaccion;
    }

    static calcTotal(libros: LibroTransaccion[], descuento: number){
        let total = libros.reduce((acumulador, libro) => 
            acumulador + libro.cantidad * libro.precio
        , 0);

        total -= (total * descuento * 0.01);
        total = parseFloat(total.toFixed(2));
        return total;
    }

    static async insert(body: Omit<SaveVenta, 'id_transaccion'> & SaveTransaccion, connection: DBConnection){
        const transaction = await Transaccion.insert({
            type: body.type,
            id_cliente: body.id_cliente,
            file_path: body.file_path,
            user: body.user,
        }, connection);

        const venta = await this._insert<SaveVenta, Venta>({
            id_transaccion: transaction.id ,
            descuento: body.descuento,
            medio_pago: body.medio_pago,
            total: body.total,
            tipo_cbte: body.tipo_cbte 
        }, connection);

        return new Venta({...venta, ...transaction});
    }

    static async getById(id: number){
        const query = `
            SELECT V.*, T.*
            FROM ventas V
            INNER JOIN transacciones T
                ON V.id_transaccion = T.id
            WHERE T.id = ?
        `;
        const [rows] = await conn.query<RowDataPacket[]>(query, [id]);
        if (rows.length !== 1){
            throw new NotFound(`No se encontró la venta con id ${id}`);
        }

        const venta = new Venta(rows[0] as (VentaSchema & TransaccionSchema));
        venta.parsePath(this.filesFolder);
        return venta;
    }

    static async getAll(userId: number){
        const [rows] = await conn.query<RowDataPacket[]>(`
            SELECT 
                V.id_transaccion as id, V.*, CONCAT('${filesUrl}', '/', '${Venta.filesFolder}', '/', T.file_path) AS file_path,
                cuit, nombre as nombre_cliente, email, cond_fiscal, tipo
            FROM ventas V
            INNER JOIN transacciones T
                ON V.id_transaccion = T.id
            INNER JOIN clientes C
                ON T.id_cliente = C.id
            WHERE T.user = ?
            ORDER BY V.id_transaccion DESC
        `, [userId]);
        return rows;
    }
}
