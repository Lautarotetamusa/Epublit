import {conn} from '../db'
import { Libro } from './libro.model';
import { Cliente } from "./cliente.model";

import { ValidationError } from './errors';
import { BaseModel } from './base.model';
import { CreateVenta, MedioPago, SaveVenta, VentaSchema } from '../schemas/venta.schema';
import { LibroCantidad, LibroSchema } from '../schemas/libros.schema';
import { RowDataPacket } from 'mysql2';

export class LibroVenta extends Libro {
    cantidad: number;

    static table_name = "libros_ventas";

    constructor(req: {libro: LibroSchema, cantidad: number}){
        super(req.libro);
        
        this.cantidad = req.cantidad;
    }

    static async set_libros(body: LibroCantidad[]): Promise<LibroVenta[]>{
        let libros: LibroVenta[] = [];

        for (let _libro of body) {
            let libro = await Libro.get_by_isbn(_libro.isbn);

            libros.push(new LibroVenta({
                libro: libro,
                cantidad: _libro.cantidad
            }))

            if (libro.stock < _libro.cantidad){
                throw new ValidationError(`El libro ${libro.titulo} con isbn ${libro.isbn} no tiene suficiente stock`)
            }
        }
        return libros;
    }

    static async bulk_insert(libros: LibroCantidad[]){
        await this._bulk_insert(libros);
    }
}

export class Venta extends BaseModel{
    static table_name = 'ventas';

    id: number;
    descuento: number;
    medio_pago: MedioPago;
    total: number;
    file_path: string;
    fecha: Date;
    id_cliente: number;

    punto_venta: number;
    tipo_cbte: number;

    constructor(request: VentaSchema){
        super();

        this.descuento  = request.descuento;
        this.punto_venta = 4;
        this.tipo_cbte   = 11;

        this.medio_pago = request.medio_pago;
        this.total = request.total;
        this.file_path = request.file_path;
        this.fecha = request.fecha;
        this.id = request.id;
        this.id_cliente = request.id_cliente;
    }

    static calcTotal(libros: LibroVenta[], descuento: number){
        let total = libros.reduce((acumulador, libro) => 
            acumulador + libro.cantidad * libro.precio
        , 0);

        total -= (total * descuento * 0.01);
        total = parseFloat(total.toFixed(2));
        return total;
    }

    static async insert(body: SaveVenta){
        return await this._insert<SaveVenta, Venta>(body);
    }

    static async get_by_id(id: number){
        return await this.find_one<VentaSchema, Venta>({id: id});
    }

    async get_libros(): Promise<LibroVenta[]>{
        const [libros] = await conn.query<RowDataPacket[]>(`
            SELECT libros.isbn, titulo, cantidad, precio_venta 
            FROM libros
            INNER JOIN libros_ventas
                ON libros_ventas.isbn = libros.isbn
            WHERE libros_ventas.id_venta = ?
        `, [this.id]);
        return libros as LibroVenta[];
    }

    static async get_all(){
        const [rows] = await conn.query<RowDataPacket[]>(`
            SELECT 
                ventas.*,
                cuit, nombre as nombre_cliente, email, cond_fiscal, tipo
            FROM ventas
            INNER JOIN clientes
                ON ventas.id_cliente = clientes.id
        `);
        return rows;
    }
}
