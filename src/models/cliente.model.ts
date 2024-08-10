import { conn } from '../db';
import { ValidationError, NotFound, NothingChanged } from './errors';
import { BaseModel } from './base.model';
import { 
    TipoCliente, 
    ClienteSchema, 
    StockCliente,
    tipoCliente,
    CreateCliente,
    SaveClienteInscripto,
    UpdateCliente,
    LibroClienteSchema, 
} from '../schemas/cliente.schema';
import { AfipData } from '../schemas/afip.schema';
import { ResultSetHeader, RowDataPacket, PoolConnection } from "mysql2/promise";
import { Venta } from './venta.model';

import { getAfipData } from "../afip/Afip";
import { filesUrl } from '../app';
import { tipoTransaccion } from '../schemas/transaccion.schema';
import { LibroTransaccion } from './transaccion.model';
import { assert } from 'console';

export class Cliente extends BaseModel{
    static table_name = "clientes";
    static libros_table = "libro_cliente";
    static fields = ["id", "nombre", "tipo", "email", "cuit", "cond_fiscal", "razon_social", "domicilio"];
    static pk = 'id';

    id: number;
    nombre: string;
    email: string;
    cuit: string;
    cond_fiscal: string;
    razon_social: string;
    domicilio: string;
    tipo: TipoCliente;

    constructor(request: ClienteSchema){
        super();

        this.id = request.id;

        this.nombre = request.nombre;
        this.email  = request.email || "";

        this.cuit = request.cuit;
        this.tipo = request.tipo;

        this.razon_social = request.razon_social;
        this.domicilio    = request.domicilio;
        this.cond_fiscal  = request.cond_fiscal;
    }

    generatePath(){
        const date = new Date().toISOString()
            .replace(/\..+/, '')     // delete the . and everything after;
            .replace(/T/, '_')       // replace T with a space

        return this.razon_social
            .replace('/-/g', '')
            .replaceAll(' ', '')+'_'+date+'.pdf';
    }

    static getAll(userId: number, tipo?: TipoCliente) {
        if (tipo){
            return this.find_all<ClienteSchema>({user: userId, tipo: tipo});
        }
        return this.find_all<ClienteSchema>({user: userId});
    }

    static async getById(id: number, userId: number): Promise<Cliente> {
        return await this.find_one<ClienteSchema, Cliente>({id: id, user: userId});
    }

    static async getConsumidorFinal(): Promise<Cliente>{
        return await this.find_one({tipo: tipoCliente.particular});
    }

    static cuilExists(cuit: string, userId: number): Promise<boolean>{
        return this._exists({cuit: cuit, tipo: tipoCliente.inscripto, user: userId})
    }

    static insert(body: CreateCliente, afipData: AfipData, userId: number): Promise<Cliente> {
        return this._insert<SaveClienteInscripto, Cliente>({
            ...body,
            cond_fiscal: afipData.cond_fiscal,
            domicilio: afipData.domicilio,
            razon_social: afipData.razon_social,
            user: userId,
            tipo: "inscripto"//No se puede crear un cliente que no sea inscripto
        });
    }
  
    async update(data: UpdateCliente) {
        if (tipoCliente[this.tipo] == tipoCliente.particular){
            throw new ValidationError("No se puede actualizar un cliente CONSUMIDOR FINAL");
        }

        // Update cuit 
        if (data.cuit && (data.cuit != this.cuit)){
            const afipData = await getAfipData(data.cuit);
            this.cond_fiscal = afipData.cond_fiscal;
            this.razon_social = afipData.razon_social;
            this.domicilio = afipData.cond_fiscal;
        }

        this.cuit   = data.cuit     || this.cuit;
        this.nombre = data.nombre   || this.nombre;
        this.email  = data.email    || this.email;

        await Cliente._update<UpdateCliente>(this, {id: this.id});
    }

    static async delete(id: number, userId: number){
        const res = await this._delete({id: id, user: userId});
        if (res.affectedRows == 0)
            throw new NotFound(`No se encuentra el cliente con id ${id}`);
    }

    async getVentas(): Promise<Venta[]>{
        const query = `
            SELECT T.*, V.*, CONCAT('${filesUrl}', '/', '${Venta.filesFolder}', '/', file_path) AS file_path
            FROM transacciones T
            INNER JOIN ventas V
                ON V.id_transaccion = T.id
            WHERE id_cliente = ?
            AND type = '${tipoTransaccion.venta}'
            ORDER BY id DESC
        `;
        const [rows] = await conn.query<RowDataPacket[]>(query, [this.id]);
        return rows as Venta[];
    }

    /*
        * Actualiza los precios de los libros de este cliente a los nuevos precios
        * */
    async updatePrecios(connection: PoolConnection){
        assert(this.tipo == tipoCliente.inscripto, "Un cliente que no es inscripto no puede tener stock")

        const join = `INNER JOIN libros L
            ON L.id_libro = LC.id_libro
            AND L.precio != LC.precio
            AND LC.id_cliente = ? `;

        const query = `
            INSERT INTO precio_libro_cliente (id_libro, id_cliente, precio) (
                SELECT L.id_libro, LC.id_cliente, L.precio 
                FROM ${Cliente.libros_table} LC
                ${join}
            )`;

        try{
            await connection.query<ResultSetHeader>(query, [this.id]);
            connection.release();

            const updatePrecios = `
                UPDATE ${Cliente.libros_table} LC
                ${join}
                SET LC.precio = L.precio; `;
            const [res] = await connection.query<ResultSetHeader>(updatePrecios, [this.id]);

            if(res.affectedRows <= 0){
                throw new NothingChanged("Todos los libros ya tienen el ultimo precio actualizado")
            }
        }catch(e){
            connection.release();
            throw e;
        }
    }

    /*
        * Obtiene la lista de libros
        * Si se pasa una fecha, obtiene el precio que tenia el libro en esa fecha
        */
    async getLibros(userId: number, fecha?: Date): Promise<LibroClienteSchema[]> {
        if (fecha === undefined){
            const [rows] = await conn.query<RowDataPacket[]>(`
                SELECT 
                    titulo, L.id_libro, L.isbn, LC.precio, LC.stock
                FROM ${Cliente.libros_table} as LC
                INNER JOIN libros L
                    ON L.id_libro = LC.id_libro
                WHERE id_cliente = ?
            `, [this.id]);
            return rows as LibroClienteSchema[];
        }

        //TODO: No hardcodear el datetime
        const [rows] = await conn.query<RowDataPacket[]>(`
            SELECT 
            titulo, L.id_libro, L.isbn, PLC.precio, LC.stock
            FROM precio_libro_cliente as PLC
            INNER JOIN (
                SELECT id_libro, MAX(created_at) as last_date
                FROM precio_libro_cliente PLC
                WHERE DATE_SUB(PLC.created_at, INTERVAL 3 HOUR) < ?
                AND PLC.id_cliente = ?
                GROUP BY id_libro
            ) AS LP
                ON  LP.id_libro = PLC.id_libro
                AND LP.last_date = PLC.created_at
                AND PLC.id_cliente = ?
            INNER JOIN libros L
                ON L.id_libro = PLC.id_libro
                AND L.user = ?
            INNER JOIN libro_cliente as LC
                ON LC.id_libro = PLC.id_libro
                AND LC.id_cliente = PLC.id_cliente
        `, [fecha, this.id, this.id, userId]);
        return rows as LibroClienteSchema[];
    }

    async addStock(libros: LibroTransaccion[], connection: PoolConnection){
        const stock_clientes = libros.map(l => [this.id, l.id_libro, l.cantidad, l.isbn, l.precio])

        try{
            await connection.query<ResultSetHeader>(`
                INSERT INTO ${Cliente.libros_table}
                    (id_cliente, id_libro, stock, isbn, precio)
                    VALUES ?
                ON DUPLICATE KEY UPDATE
                    stock = stock + VALUES(stock)
            `, [stock_clientes]);
            connection.release();

            // Insertamos el precio en precio_libro_cliente
            await connection.query<ResultSetHeader>(`
                INSERT INTO precio_libro_cliente (id_libro, id_cliente, precio)
                SELECT LC.id_libro, LC.id_cliente, LC.precio 
                FROM libro_cliente LC
                INNER JOIN libros L 
                    ON L.id_libro = LC.id_libro
                LEFT JOIN precio_libro_cliente PLC 
                    ON  PLC.id_libro = LC.id_libro 
                    AND PLC.id_cliente = LC.id_cliente
                WHERE LC.id_cliente = ?
                  AND PLC.id_libro IS NULL
            `, [this.id]);
            connection.release();
        }catch(e){
            connection.release();
            throw e;
        }
    }

    async reduceStock(libros: LibroTransaccion[], connection: PoolConnection){
        const stock_clientes = libros.map(l => [this.id, l.id_libro, l.cantidad, l.isbn, l.precio])

        try{
            await connection.query<ResultSetHeader>(`
                INSERT INTO ${Cliente.libros_table}
                    (id_cliente, id_libro, stock, isbn, precio)
                    VALUES ?
                ON DUPLICATE KEY UPDATE
                    stock = stock - VALUES(stock)
            `, [stock_clientes]);
            connection.release();
        }catch(e){
            connection.release();
            throw e;
        }
    }

    async haveStock(libros: StockCliente){
        for (const libro of libros){
            const [rows] = await conn.query<RowDataPacket[]>(`
                SELECT COUNT(*) as count FROM ${Cliente.libros_table}
                WHERE id_cliente = ?
                AND id_libro = ?
                AND stock < ?;
            `, [this.id, libro.id_libro, libro.cantidad]); 
            const count = rows[0].count;

            if (count > 0){
                throw new NotFound(`No hay suficiente stock del libro ${libro.isbn} para el cliente ${this.nombre} (${this.id})`);
            }
        }
    }
}
