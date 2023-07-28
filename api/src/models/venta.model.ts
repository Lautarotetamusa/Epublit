import {conn} from '../db.js'
import { Libro } from './libro.model.js';
import { Cliente } from "./cliente.model.js";

import { ValidationError } from './errors.js';
import { BaseModel } from './base.model.js';
import { buildVenta, createVenta, libroVenta, medio_pago, saveVenta } from '../schemas/venta.schema.js';
import { retrieveLibro } from '../schemas/libros.schema.js';
import { RowDataPacket } from 'mysql2';

export class LibroVenta extends Libro {
    cantidad: number;

    static table_name = "libros_ventas";

    constructor(req: {libro: retrieveLibro, cantidad: number}){
        super(req.libro);
        
        this.cantidad = req.cantidad;
    }
}

export class Venta extends BaseModel{
    id?: number;
    descuento: number;
    medio_pago: medio_pago;
    total: number;
    file_path: string;

    punto_venta: number;
    tipo_cbte: number;

    cliente: Cliente;
    libros: LibroVenta[];

    static table_name = 'ventas';

    constructor(request: buildVenta & {id?: number}){
        super();

        this.descuento  = request.descuento || 0;
        this.punto_venta = 4;
        this.tipo_cbte   = 11;

        this.medio_pago = request.medio_pago;

        this.cliente    = request.cliente;
        this.libros     = request.libros;
        this.total = request.total;
        this.file_path = request.file_path;

        if ('id' in request)
            this.id = request.id;
    }

    static async set_libros(_libros: libroVenta[]): Promise<LibroVenta[]>{
        let libros: LibroVenta[] = [];

        for (let _libro of _libros) {
            let libro = await Libro.get_by_isbn(_libro.isbn);

            libros.push(new LibroVenta({
                libro: libro,
                cantidad: _libro.cantidad
            }))

            if (libro.stock < _libro.cantidad)
                throw new ValidationError(`El libro ${libro.titulo} con isbn ${libro.isbn} no tiene suficiente stock`)
        }
        return libros;
    }

    calc_total(){
        let total = this.libros.reduce((acumulador, libro) => 
            acumulador + libro.cantidad * libro.precio
        , 0);

        total -= (total * this.descuento * 0.01);
        total = parseFloat(total.toFixed(2));

        this.total = total;
    }

    static async build(req: createVenta): Promise<Venta>{
        const cliente = await Cliente.get_by_id(req.cliente);

        let date = new Date().toISOString()
            .replace(/\..+/, '')     // delete the . and everything after;
            .replace(/T/, '_')       // replace T with a space
            .replace(/\-/gi, '_')
            .replace(/\:/gi, '');

        let venta = new Venta({
            ...req,
            libros: await this.set_libros(req.libros),
            cliente: cliente,
            total: 0,
            file_path: cliente.nombre.replace(' ', '')+'_'+date+'.pdf',            
        });
        venta.calc_total();
        return venta;
    }
        
    async save(){
        let venta = await Venta._insert<saveVenta, Venta>({
            id_cliente: this.cliente.id,
            total: this.total,
            file_path: this.file_path,
            descuento: this.descuento,
            medio_pago: this.medio_pago
        });
        this.id = venta.id;
    
        await LibroVenta._bulk_insert(this.libros.map(l => ({
            id_venta: venta.id, 
            cantidad: l.cantidad, 
            isbn: l.isbn, 
            precio_venta: l.precio
        })));

        for (const libro of this.libros){
            await libro.update_stock(-libro.cantidad);
        }
    }

    static async get_by_id(id: number){

        const venta = await this.find_one<buildVenta, Venta>({id: id});

        venta.libros = await venta.get_libros();
        return venta;
    }

    async get_libros(): Promise<LibroVenta[]>{
        let [libros] = await conn.query<RowDataPacket[]>(`
            SELECT libros.isbn, titulo, cantidad, precio_venta 
            FROM libros
            INNER JOIN libros_ventas
                ON libros_ventas.isbn = libros.isbn
            INNER JOIN ventas
                ON ventas.id = libros_ventas.id_venta
            WHERE ventas.id = ${this.id}
        `);
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