import {conn} from '../db'
import { Libro } from './libro.model';
import { ValidationError } from './errors';
import { BaseModel, DBConnection } from './base.model';
import { MedioPago, SaveVenta, VentaSchema } from '../schemas/venta.schema';
import { LibroCantidad } from '../schemas/libros.schema';
import { RowDataPacket } from 'mysql2';
import { filesUrl } from '../app';

type libroVentaSchema = {
    cantidad: number, 
    precio_venta: number
};

export class LibroVenta extends Libro{
    cantidad: number;
    precio_venta: number;

    static table_name = "libros_ventas";

    constructor(req: {libro: Libro} & libroVentaSchema){
        super(req.libro);

        this.cantidad = req.cantidad;
        this.precio_venta = req.precio_venta;
    }

    static async setLibros(body: LibroCantidad[], userId: number): Promise<LibroVenta[]>{
        let libros: LibroVenta[] = [];

        for (const libroBody of body) {
            const libro = await Libro.getByIsbn(libroBody.isbn, userId);

            libros.push(new LibroVenta({
                libro: libro,
                cantidad: libroBody.cantidad,
                precio_venta: libro.precio 
            }))

            if (libro.stock < libroBody.cantidad){
                throw new ValidationError(`El libro ${libro.titulo} con isbn ${libro.isbn} no tiene suficiente stock`)
            }
        }
        return libros;
    }

    static async save(body: LibroVenta[], id_venta: number, conn: DBConnection){
        const libros = body.map(libro => ({
            cantidad: libro.cantidad,
            precio_venta: libro.precio_venta,
            isbn: libro.isbn,
            id_venta: id_venta
        }));
        await this._bulk_insert<libroVentaSchema>(libros, conn);
    }
}

export class Venta extends BaseModel{
    static table_name = 'ventas';
    static filesFolder = 'facturas';
    static pk = 'id';

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
        this.tipo_cbte   = request.tipo_cbte;

        this.medio_pago = request.medio_pago;
        this.total = request.total;
        this.file_path = request.file_path;
        this.fecha = request.fecha;
        this.id = request.id;
        this.id_cliente = request.id_cliente;
    }

    static calcTotal(libros: LibroVenta[], descuento: number){
        let total = libros.reduce((acumulador, libro) => 
            acumulador + libro.cantidad * libro.precio_venta
        , 0);

        total -= (total * descuento * 0.01);
        total = parseFloat(total.toFixed(2));
        return total;
    }

    parsePath(){
        this.file_path = this.file_path ? `${filesUrl}/${Venta.filesFolder}/${this.file_path}` : this.file_path;
    }

    static async insert(body: SaveVenta, conn: DBConnection){
        return await this._insert<SaveVenta, Venta>(body, conn);
    }

    static async getById(id: number, userId: number){
        const venta = await this.find_one<VentaSchema, Venta>({
            id: id, user: userId
        });
        venta.parsePath();
        return venta;
    }

    async getLibros(userId: number): Promise<LibroVenta[]>{
        const [libros] = await conn.query<RowDataPacket[]>(`
            SELECT libros.isbn, titulo, cantidad, precio_venta 
            FROM libros
            INNER JOIN libros_ventas
                ON libros_ventas.isbn = libros.isbn
            WHERE libros_ventas.id_venta = ?
            AND libros.user = ?
        `, [this.id, userId]);
        return libros as LibroVenta[];
    }

    static async getAll(userId: number){
        const [rows] = await conn.query<RowDataPacket[]>(`
            SELECT 
                ventas.*, CONCAT('${filesUrl}', '/', '${Venta.filesFolder}', '/', ventas.file_path) AS file_path,
                cuit, nombre as nombre_cliente, email, cond_fiscal, tipo
            FROM ventas
            INNER JOIN clientes
                ON ventas.id_cliente = clientes.id
            WHERE ventas.user = ?
            ORDER BY ventas.id DESC
        `, [userId]);
        return rows;
    }
}
