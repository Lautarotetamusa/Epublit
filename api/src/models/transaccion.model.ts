import {conn} from '../db'
import { Libro } from './libro.model';
import { BaseModel, DBConnection } from './base.model';
import { SaveTransaccion, TipoTransaccion, TransaccionSchema, tipoTransaccion } from '../schemas/transaccion.schema';
import { LibroCantidad } from '../schemas/libros.schema';
import { RowDataPacket } from 'mysql2';
import { filesUrl } from '../app';

type libroTransaccionSchema = {
    cantidad: number, 
    precio: number,
};

export class LibroTransaccion extends Libro{
    cantidad: number;
    precio: number;

    static table_name = "libros_transacciones";

    constructor(req: {libro: Libro} & libroTransaccionSchema){
        super(req.libro);

        this.cantidad = req.cantidad;
        this.precio = req.precio;
    }

    static async setLibros(body: LibroCantidad[], userId: number): Promise<LibroTransaccion[]>{
        let libros: LibroTransaccion[] = [];

        for (const libroBody of body) {
            const libro = await Libro.getByIsbn(libroBody.isbn, userId);

            libros.push(new LibroTransaccion({
                libro: libro,
                cantidad: libroBody.cantidad,
                precio: libro.precio 
            }))
        }
        return libros;
    }

    static async save(body: LibroTransaccion[], id_transaccion: number, connection: DBConnection){
        const libros = body.map(libro => ({
            cantidad: libro.cantidad,
            precio: libro.precio,
            id_libro: libro.id_libro,
            id_transaccion: id_transaccion
        }));
        await this._bulk_insert<libroTransaccionSchema>(libros, connection);
    }
}

export abstract class Transaccion extends BaseModel{
    static table_name = 'transacciones';
    static type: TipoTransaccion;
    static filesFolder: string;
    static pk = 'id';

    id: number;
    id_cliente: number;
    type: TipoTransaccion;
    file_path: string;
    fecha: Date;
    user: number;

    constructor(request: TransaccionSchema){
        super();

        this.id = request.id;
        this.id_cliente = request.id_cliente;
        this.type = request.type;
        this.file_path = request.file_path;
        this.fecha = request.fecha;
        this.user = request.user;
    }

    parsePath(filesFolder: string){
        this.file_path = this.file_path ? `${filesUrl}/${filesFolder}/${this.file_path}` : this.file_path;
    }

    static async insert(body: SaveTransaccion, connection: DBConnection){
        return await this._insert<SaveTransaccion, Transaccion>(body, connection);
    }

    static async getById(id: number){
        const transaccion = await this.find_one<TransaccionSchema, Transaccion>({
            id: id
        });
        transaccion.parsePath(this.filesFolder);
        return transaccion;
    }

    async getLibros(): Promise<LibroTransaccion[]>{
        const [libros] = await conn.query<RowDataPacket[]>(`
            SELECT L.isbn, titulo, cantidad, LT.precio
            FROM libros L
            INNER JOIN ${LibroTransaccion.table_name} LT
                ON LT.id_libro = L.id_libro
            WHERE LT.id_transaccion = ?
        `, [this.id]);
        return libros as LibroTransaccion[];
    }

    static async getAll(userId: number){
        const [rows] = await conn.query<RowDataPacket[]>(`
            SELECT 
                T.id, T.id_cliente, T.fecha, 
                CONCAT('${filesUrl}', '/', '${this.filesFolder}', '/', T.file_path) AS file_path,
                cuit, nombre as nombre_cliente, email, cond_fiscal, C.tipo
            FROM ${Transaccion.table_name} T
            INNER JOIN clientes C
                ON T.id_cliente = C.id
            WHERE T.user = ?
            AND T.type = ?
            ORDER BY T.id DESC
        `, [userId, this.type]);
        return rows;
    }
}


export class Consignacion extends Transaccion{
    static filesFolder = "remitos";
    static type = tipoTransaccion.consignacion;
}

export class Devolucion extends Transaccion{
    static type = tipoTransaccion.devolucion;
}

export class VentaConsignado extends Transaccion{
    static type = tipoTransaccion.ventaConsignacion;
}
