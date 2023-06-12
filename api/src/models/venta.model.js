import {conn} from '../db.js'
import { Libro } from './libro.model.js';
import { Cliente } from "./cliente.model.js";

import { NotFound, ValidationError } from './errors.js';

const table_name = 'ventas'

export class Venta{
    constructor(request){
        this.descuento  = request.descuento || 0;
        this.medio_pago = request.medio_pago;
        this.tipo = Venta.str_medios_pago[request.medio_pago];
    
        this.punto_venta = 4;
        this.tipo_cbte   = 11;

        this.cliente    = request.cliente;
        this.libros     = request.libros;
    }

    static medios_pago = {
        efectivo: 0,
        debito: 1,
        credito: 2,
        mercadopago: 3,
        transferencia: 4,
    }

    static str_medios_pago = [
        "efectivo",
        "debito",
        "credito",
        "mercadopago",
        "transferencia"
    ]

    static validate(request){
        if (!('medio_pago' in request))
            throw new ValidationError('El medio de pago es obligatorio para la Venta');

        if(!request.libros)
            throw new ValidationError('La Venta necesita al menos un libro');

        if(!request.cliente)
            throw new ValidationError('La Venta necesita un cliente');

        if(!(Object.keys(Venta.medios_pago)[request.medio_pago]))
            throw new ValidationError('El medio de pago es incorrecto [0..4]')
    }

    async set_client(req){
        if (typeof req == Object){
            Cliente.validate(req);
            this.cliente = new Cliente(req);
            await body.cliente.insert();
        }
        else{
            this.cliente = await Cliente.get_by_id(req);
        }

        let date = new Date().toISOString()
            .replace(/\..+/, '')     // delete the . and everything after;
            .replace(/T/, '_')       // replace T with a space
            .replaceAll('-', '_')
            .replaceAll(':', '');

        this.path = this.cliente.nombre.replaceAll(' ', '')+'_'+date+'.pdf'; 
    }

    async set_libros(req){
        this.libros = [];
        for (let i in req) {
            this.libros[i] = await Libro.get_by_isbn(req[i].isbn);
            this.libros[i].cantidad = req[i].cantidad;

            if (this.libros[i].stock < req[i].cantidad)
                throw new ValidationError(`El libro ${this.libros[i].titulo} con isbn ${this.libros[i].isbn} no tiene suficiente stock`)
        }

        this.total = this.libros.reduce((acumulador, libro) => 
            acumulador + libro.cantidad * libro.precio
        , 0);

        this.total -= (this.total * this.descuento * 0.01);
        this.total = parseFloat(this.total.toFixed(2));

        console.log("total:", this.total);
    }

    async insert(){
        let venta = (await conn.query(`
            INSERT INTO ${table_name}
                (id_cliente, descuento, medio_pago, total, file_path) 
            VALUES 
                (${this.cliente.id}, ${this.descuento}, '${this.medio_pago}', ${this.total}, '${this.path}')
        `))[0];

        this.id = venta.insertId;

        let libros_venta = this.libros.map(l => [venta.insertId, l.cantidad, l.isbn, l.precio]);
        console.log(libros_venta);

        await conn.query(`
            INSERT INTO libros_ventas
                (id_venta, cantidad, isbn, precio_venta)
            VALUES ? 
        `, [libros_venta]);
    }

    static async get_by_id(id){
        let res = (await conn.query(`
            SELECT * FROM ventas
            WHERE id=${id}
        `))[0];

        if (res.length <= 0)
            throw new NotFound(`No se encontro la venta con id ${id}`)

        let venta = res[0];

        let libros = (await conn.query(`
            SELECT libros.isbn, titulo, cantidad, precio_venta 
            FROM libros
            INNER JOIN libros_ventas
                ON libros_ventas.isbn = libros.isbn
            INNER JOIN ventas
                ON ventas.id = libros_ventas.id_venta
            WHERE ventas.id = ${id}
        `))[0];

        let clientes = (await conn.query(`
            SELECT cuit, nombre, email, tipo, cond_fiscal 
            FROM clientes
            INNER JOIN ventas
                ON ventas.id_cliente = clientes.id
            WHERE ventas.id = ${id}
        `))[0];

        console.log(libros);
        console.log(clientes);

        venta.libros = libros;
        venta.clientes = clientes;
        return venta;
    }

    static async get_all(){
        return (await conn.query(`
            SELECT 
                ventas.id, fecha, medio_pago, total, file_path,
                cuit, nombre as nombre_cliente, email, cond_fiscal, tipo
            FROM ventas
            INNER JOIN clientes
                ON ventas.id_cliente = clientes.id
        `))[0];
    }
}
