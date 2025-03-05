import {conn} from '../db'
import { NotFound, ValidationError } from './errors';
import { MedioPago, SaveVenta, VentaSchema, createVenta, createVentaConsignado } from '../schemas/venta.schema';
import { RowDataPacket, PoolConnection } from 'mysql2/promise';
import { LibroTransaccion, Transaccion } from './transaccion.model';
import { SaveTransaccion, TransaccionSchema, tipoTransaccion } from '../schemas/transaccion.schema';
import { filesUrl } from '../app';
import { Cliente } from './cliente.model';
import { LibroCantidad } from '../schemas/libros.schema';
import { Libro } from './libro.model';
import { User } from './user.model';
import { TipoCliente, tipoCliente } from '../schemas/cliente.schema';

export class Venta extends Transaccion {
    static table_name = 'ventas';
    static filesFolder = 'facturas';
    static parser = createVenta.parse;

    id_transaccion: number;
    descuento: number;
    total: number;
    medio_pago: MedioPago;

    punto_venta: number;
    tipo_cbte: number;

    constructor(request: VentaSchema & TransaccionSchema){
        super(request);

        this.descuento   = request.descuento;
        //TODO: No hardcodear esto
        this.punto_venta = 9;
        this.tipo_cbte   = request.tipo_cbte;

        this.medio_pago = request.medio_pago;
        this.total = request.total;
        this.id_transaccion = request.id_transaccion;
    }

    static async stockValidation(libros: LibroTransaccion[], cliente: Cliente){}
    clientValidation(tipo: TipoCliente) {return true}
    static async stockMovement(libros: LibroTransaccion[], cliente: Cliente, conn?: PoolConnection){}
    comprobante(libros: LibroTransaccion[], cliente: Cliente, user: User): void{};

    static calcTotal(libros: LibroTransaccion[], descuento: number){
        let total = libros.reduce((acumulador, libro) => 
            acumulador + libro.cantidad * libro.precio
        , 0);

        total -= (total * descuento * 0.01);
        total = parseFloat(total.toFixed(2));
        return total;
    }

    static async insert(body: Omit<SaveVenta, 'id_transaccion'> & SaveTransaccion, connection: PoolConnection){
        const transaction = await Transaccion.insert({
            type: this.type,
            id_cliente: body.id_cliente,
            file_path: body.file_path,
            user: body.user,
        }, connection);

        const venta = await this._insert<SaveVenta, Venta>({
            id_transaccion: transaction.id ,
            descuento: body.descuento,
            medio_pago: body.medio_pago,
            total: body.total,
            tipo_cbte: body.tipo_cbte,
        }, connection);

        return new this({...venta, ...transaction});
    }

    static async getById(id: number) {
        const query = `
            SELECT V.*, T.*, CONCAT('${filesUrl}', '/', '${Venta.filesFolder}', '/', T.file_path) AS file_path
            FROM ventas V
            INNER JOIN transacciones T
                ON V.id_transaccion = T.id
            WHERE T.id = ?
        `;
        const [rows] = await conn.query<RowDataPacket[]>(query, [id]);
        if (rows.length !== 1){
            throw new NotFound(`No se encontró la venta con id ${id}`);
        }

        return new Venta(rows[0] as VentaSchema & TransaccionSchema);
    }

    static async getAll(userId: number){
        const query = `
            SELECT 
                V.id_transaccion as id, T.type, V.*, T.fecha, 
                CONCAT('${filesUrl}', '/', '${Venta.filesFolder}', '/', T.file_path) AS file_path,
                cuit, nombre as nombre_cliente, email, cond_fiscal, tipo
            FROM ventas V
            INNER JOIN transacciones T
                ON V.id_transaccion = T.id
            INNER JOIN clientes C
                ON T.id_cliente = C.id
            WHERE T.user = ?
            ORDER BY V.id_transaccion DESC
        `;

        const [rows] = await conn.query<RowDataPacket[]>(query, [userId]);
        return rows;
    }
}

export class VentaFirme extends Venta {
    static parser = createVenta.parse;
    static type = tipoTransaccion.venta;

    async stockValidation(libros: LibroTransaccion[]){
        for (const libro of libros){
            if (libro.stock < libro.cantidad){
                throw new ValidationError(`El libro ${libro.titulo} con isbn ${libro.isbn} no tiene suficiente stock`)
            }
        }
    }
    //
    //static clientValidation(tipo: TipoCliente): boolean {
    //    return true;
    //}

    static async stockMovement(libros: LibroTransaccion[], _: Cliente, connection: PoolConnection){
        for (const libro of libros){
            await Libro.updateStock(libro.id_libro, -libro.cantidad, connection);
        }
    }
    comprobante(){
        this.file_path = "";
    }
}

export class VentaConsignado extends Venta {
    static type = tipoTransaccion.ventaConsignacion;
    static parser = createVentaConsignado.parse;

    //El precio tiene que ser el ultimo precio que tenia el cliente en esa fecha
    static async setLibros(body: LibroCantidad[], cliente: Cliente, userId: number, args: any): Promise<LibroTransaccion[]>{
        const libros: LibroTransaccion[] = [];

        const librosCliente = await cliente.getLibros(args.date); 

        for (const libro of body) {
            const libroCliente = librosCliente.find(l => l.isbn == libro.isbn);
            if (libroCliente === undefined){
                throw new ValidationError(`El cliente no tiene registrados precios para el libro ${libro.isbn} en la fecha ${args.date}`)
            }

            libros.push(new LibroTransaccion({
                ...libroCliente,
                cantidad: libro.cantidad,
                precio: libroCliente.precio,
            }))
        }

        return libros;
    }

    static clientValidation(tipo: TipoCliente): boolean {
        return tipo == tipoCliente.inscripto;
    }

    // Se reduce el stock del cliente
    static async stockMovement(libros: LibroTransaccion[], cliente: Cliente, connection: PoolConnection){
        await cliente.reduceStock(libros, connection);
    }

    comprobante(){
        this.file_path = "";
    }
}
