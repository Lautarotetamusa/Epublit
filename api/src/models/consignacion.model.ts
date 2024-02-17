import { Cliente } from './cliente.model.js'
import { Libro } from './libro.model.js'

import { ValidationError } from './errors.js';
import { retrieveLibro } from '../schemas/libros.schema.js';
import { buildConsignacion, createConsignacion, saveConsignacion } from '../schemas/consignaciones.schema.js';
import { BaseModel } from './base.model.js';
import { retrieveLibroPersona } from '../schemas/libro_persona.schema.js';
import { TipoCliente, stockCliente } from '../schemas/cliente.schema.js';
import { conn } from '../db.js';
import { RowDataPacket } from 'mysql2';

export class LibroConsignacion extends Libro {
    cantidad: number;
    autores: retrieveLibroPersona[];
    ilustradores: retrieveLibroPersona[];

    static table_name = "libros_consignaciones";

    constructor(body: {libro: retrieveLibro, cantidad: number, autores: retrieveLibroPersona[], ilustradores: retrieveLibroPersona[]}){

        super(body.libro);
        
        this.cantidad = body.cantidad;
        this.autores = body.autores;
        this.ilustradores = body.ilustradores;
    }
}

export class Consignacion extends BaseModel{
    static table_name = "consignaciones";

    id?: number;
    remito_path: string;
    libros: LibroConsignacion[];
    cliente: Cliente;

    constructor(body: buildConsignacion & {id?: number}){
        super();

        this.remito_path = body.remito_path;
        this.libros = body.libros;
        this.cliente = body.cliente;
        if ('id' in body)
            this.id = body.id;
    }

    static async set_libros(_libros: stockCliente): Promise<LibroConsignacion[]>{
        let libros: LibroConsignacion[] = [];
        for (const _libro of _libros) {
            let libro = await Libro.get_by_isbn(_libro.isbn);
            let {autores, ilustradores} = await libro.get_personas();

            libros.push(new LibroConsignacion({
                libro: libro,
                cantidad: _libro.cantidad,
                autores: autores,
                ilustradores: ilustradores
            }));

            if (libro.stock < _libro.cantidad)
                throw new ValidationError(`El libro ${libro.titulo} con isbn ${libro.isbn} no tiene suficiente stock`);
        }

        return libros;        
    }

    static async build(body: createConsignacion): Promise<Consignacion>{
        const cliente = await Cliente.get_by_id(body.cliente);
        if (cliente.tipo == TipoCliente.particular){
            throw new ValidationError("No se puede hacer una consignacion a un cliente CONSUMIDOR FINAL");
        }

        const date = new Date().toISOString()
            .replace(/\..+/, '')     // delete the . and everything after;
            .replace(/T/, '_')       // replace T with a space
            .replace(/\-/gi, '_')
            .replace(/\:/gi, '');

        return new Consignacion({
            ...body,
            libros: await this.set_libros(body.libros),
            cliente: cliente,
            remito_path: cliente.razon_social.replace('/-/g', '')+'_'+date+'.pdf'
        }); 
    }
    
    async save(){
        const consignacion = await Consignacion._insert<saveConsignacion, Consignacion>({
            id_cliente: this.cliente.id,
            remito_path: this.remito_path,
        });
        this.id = consignacion.id;
        
        await LibroConsignacion._bulk_insert(this.libros.map(l => ({
            id_consignacion: this.id, 
            isbn: l.isbn, 
            cantidad: l.cantidad, 
        })));
        
        for (const libro of this.libros) {
            await libro.update_stock(-libro.cantidad);
        }
    }

    static async get_by_id(id: number){
        const cons = await this.find_one<buildConsignacion, Consignacion>({id: id});

        cons.libros = await cons.get_libros();
        return cons;
    }

    async get_libros(): Promise<LibroConsignacion[]>{
        const [libros] = await conn.query<RowDataPacket[]>(`
            SELECT libros.isbn, titulo, cantidad 
            FROM libros
            INNER JOIN libros_consignaciones
                ON libros_consignaciones.isbn = libros.isbn
            INNER JOIN consignaciones
                ON consignaciones.id = libros_consignaciones.id_consignacion
            WHERE consignaciones.id = ?
        `, [this.id]);
        return libros as LibroConsignacion[];
    }

    static async get_all(){
        const [rows] = await conn.query(`
            SELECT 
                consignaciones.id, fecha, remito_path,
                cuit, nombre as nombre_cliente, email, cond_fiscal, tipo
            FROM consignaciones
            INNER JOIN clientes
                ON consignaciones.id_cliente = clientes.id
        `);
        return rows;
    }
}

