import { conn } from '../db';
import { ValidationError, NotFound } from './errors';
import { BaseModel } from './base.model';
import { 
    AfipData, 
    TipoCliente, 
    ClienteSchema, 
    StockCliente,
    tipoCliente,
    CreateCliente,
    SaveClienteInscripto,
    UpdateCliente, 
} from '../schemas/cliente.schema';
import { RowDataPacket } from 'mysql2';
import { Venta } from './venta.model';

import { getAfipData } from "../afip/Afip";
import { filesUrl } from '../app';

export class Cliente extends BaseModel{
    static table_name = "clientes";
    static fields = ["id", "nombre", "tipo", "email", "cuit", "cond_fiscal", "razon_social", "domicilio"];

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
            .replace(/\-/gi, '_')
            .replace(/\:/gi, '');

        return this.razon_social
            .replace('/-/g', '')
            .replace(' ', '')+'_'+date+'.pdf';
    }

    static async getAll() {
        return await this.find_all();
    }

    static async getById(id: number): Promise<Cliente> {
        return await this.find_one<ClienteSchema, Cliente>({id: id});
    }

    static async getConsumidorFinal(): Promise<Cliente>{
        return await this.find_one({tipo: tipoCliente.particular});
    }

    static async cuilExists(cuit: string): Promise<Boolean>{
        return await this._exists({cuit: cuit, tipo: tipoCliente.inscripto})
    }

    static async insert(body: CreateCliente): Promise<Cliente> {
        const afip_data: AfipData = await getAfipData(body.cuit);
        return await this._insert<SaveClienteInscripto, Cliente>({
            ...body,
            ...afip_data,
            tipo: "inscripto" //No se puede crear un cliente que no sea inscripto
        });
    }
  
    async update(data: UpdateCliente) {
        if (tipoCliente[this.tipo] == tipoCliente.particular){
            throw new ValidationError("No se puede actualizar un cliente CONSUMIDOR FINAL");
        }

        // Update cuit 
        if (data.cuit && (data.cuit != this.cuit)){
            const afip_data = await getAfipData(data.cuit);
            this.cond_fiscal = afip_data.cond_fiscal;
            this.razon_social = afip_data.razon_social;
            this.domicilio = afip_data.cond_fiscal;
        }

        this.cuit   = data.cuit     || this.cuit;
        this.nombre = data.nombre   || this.nombre;
        this.email  = data.email    || this.email;

        await Cliente._update<UpdateCliente>(this, {id: this.id});
    }

    static async delete(id: number){
        const res = await this._delete({id: id});
        if (res.affectedRows == 0)
            throw new NotFound(`No se encuentra el cliente con id ${id}`);
    }

    async getVentas(userId: number): Promise<Venta[]>{
        const query = `
            SELECT *, CONCAT('${filesUrl}', '/', '${Venta.filesFolder}', '/', ventas.file_path) AS file_path
            FROM ventas
            WHERE id_cliente = ?
            AND user = ?
            ORDER BY id DESC
        `;
        const [rows] = await conn.query<RowDataPacket[]>(query, [this.id, userId]);
        return rows as Venta[];
    }

    async getStock() {
        const [rows] = await conn.query<RowDataPacket[]>(`
            SELECT 
                titulo, libros.isbn, sc.stock
            FROM stock_cliente as sc
            INNER JOIN libros
                ON libros.isbn = sc.isbn
            WHERE id_cliente=?
        `, [this.id]);
        return rows;
    }

    async updateStock(libros: StockCliente){
        const stock_clientes = libros.map(l => [this.id, l.cantidad, l.isbn])
        await conn.query(`
            INSERT INTO stock_cliente
                (id_cliente, stock, isbn)
                VALUES ?
            ON DUPLICATE KEY UPDATE
                stock = stock + VALUES(stock)
        `, [stock_clientes]);
    }

    async haveStock(libros: StockCliente){
        for (const libro of libros){
            const [rows] = await conn.query<RowDataPacket[]>(`
                SELECT COUNT(*) as count FROM stock_cliente
                WHERE id_cliente=?
                AND isbn = ?
                AND stock < ?;
            `, [this.id, libro.isbn, libro.cantidad]); 
            const count = rows[0].count;

            if (count > 0){
                throw new NotFound(`No hay suficiente stock del libro ${libro.isbn} para el cliente ${this.nombre} (${this.id})`);
            }
        }
    }
}
