import {conn} from '../db.js';
import { ValidationError, NotFound, NothingChanged, Duplicated } from './errors.js';
import afip from "../afip/Afip.js";
import { BaseModel } from './base.model.js';
import { AfipData, TipoCliente, createCliente, retrieveCliente, saveClienteInscripto, stockCliente, updateCliente } from '../schemas/cliente.schema.js';
import { RowDataPacket } from 'mysql2';

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

    constructor(request: retrieveCliente){
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

    static async get_all() {
        return await this.find_all();
    }

    static async get_by_id(id: number): Promise<Cliente> {
        return await this.find_one<createCliente, Cliente>({id: id});
    }

    static async get_consumidor_final(): Promise<Cliente>{
        return await this.find_one({tipo: TipoCliente.particular});
    }
    
    static async get_afip_data(cuit: string){
        const afip_data = await afip.RegisterScopeFive?.getTaxpayerDetails(cuit);
        if (afip_data === null)
            throw new NotFound(`La persona con CUIT ${cuit} no está cargada en afip`);

        let data: AfipData = {
            cond_fiscal: " - ",
            domicilio: " - ",
            razon_social: " - "
        };

        if (!afip_data.datosGenerales.domicilioFiscal.localidad)
            afip_data.datosGenerales.domicilioFiscal.localidad = 'CAPITAL FEDERAL'

        let impuestos = null;
        if (afip_data.datosRegimenGeneral)
            impuestos = afip_data.datosRegimenGeneral.impuesto
        else if(afip_data.datosMonotributo)
            impuestos = afip_data.datosMonotributo.impuesto

        if (impuestos){
            var iva = (impuestos as {
                idImpuesto: number,
                descripcionImpuesto: string
            }[]).find(i => i.idImpuesto == 32);

            if (iva)
            data.cond_fiscal = iva.descripcionImpuesto;
        }else{
            data.cond_fiscal = " - ";
        }
        

        if (afip_data.datosGenerales.tipoPersona == 'JURIDICA')
            data.razon_social = afip_data.datosGenerales.razonSocial;
        else 
            data.razon_social = afip_data.datosGenerales.nombre+' '+afip_data.datosGenerales.apellido;

        data.domicilio = ''
            + afip_data.datosGenerales.domicilioFiscal.direccion+' - '
            + afip_data.datosGenerales.domicilioFiscal.localidad+ ' ' 
            + afip_data.datosGenerales.domicilioFiscal.descripcionProvincia;

        return data;
    }

    static async cuil_exists(cuit: string): Promise<Boolean>{
        return await this._exists({cuit: cuit, tipo: TipoCliente.inscripto})
    }

    static async insert(_req: createCliente): Promise<Cliente> {
        let afip_data: AfipData = await this.get_afip_data(_req.cuit);
        return await this._insert<saveClienteInscripto, Cliente>({
            ..._req,
            ...afip_data,
            tipo: TipoCliente.inscripto //No se puede crear un cliente que no sea inscripto
        });
    }

  
    async update(data: updateCliente) {
        if (this.tipo == TipoCliente.particular)
            throw new ValidationError("No se puede actualizar un cliente CONSUMIDOR FINAL");

        // Update cuit
        if (data.cuit && (data.cuit != this.cuit)){
            let afip_data = await Cliente.get_afip_data(data.cuit);
            this.cond_fiscal = afip_data.cond_fiscal;
            this.razon_social = afip_data.razon_social;
            this.domicilio = afip_data.cond_fiscal;
        }

        this.cuit   = data.cuit     || this.cuit;
        this.nombre = data.nombre   || this.nombre;
        this.email  = data.email    || this.email;

        await Cliente._update<updateCliente>(this, {id: this.id});
    }

    static async delete(id: number){
        let res = await this._delete({id: id});
        if (res.affectedRows == 0)
            throw new NotFound(`No se encuentra el cliente con id ${id}`);
    }

    async get_ventas(){
        //const res = await Venta.find_one({id_cliente: this.id});
        const [rows] = await conn.query<RowDataPacket[]>(`
            SELECT 
                id, fecha, total, file_path
            FROM ventas
            WHERE id_cliente=${this.id}
        `);
        return rows;
    }

    async get_stock() {
        const [rows] = await conn.query<RowDataPacket[]>(`
            SELECT 
                titulo, libros.isbn, sc.stock
            FROM stock_cliente as sc
            INNER JOIN libros
                ON libros.isbn = sc.isbn
            WHERE id_cliente=${this.id}
        `);
        return rows;
    }

    async update_stock(libros: stockCliente){
        let stock_clientes = libros.map(l => [this.id, l.cantidad, l.isbn])
        await conn.query(`

            INSERT INTO stock_cliente
                (id_cliente, stock, isbn)
                VALUES ?
            ON DUPLICATE KEY UPDATE
                stock = stock + VALUES(stock)

        `, [stock_clientes]);
    }

    async have_stock(libros: stockCliente){
        for (let libro of libros){
            //const res = await Cliente.find_all({id_cliente: this.id, isbn: libro.isbn, stock: libro.cantidad});

            let count = (await conn.query<RowDataPacket[]>(`

                SELECT COUNT(*) as count FROM stock_cliente
                WHERE id_cliente=${this.id}
                AND isbn = ${libro.isbn}
                AND stock < ${libro.cantidad};

            `))[0][0].count;

            if (count > 0){
                throw new NotFound(`No hay suficiente stock del libro ${libro.isbn} para el cliente ${this.nombre} (${this.id})`);
            }
        }
    }
}
