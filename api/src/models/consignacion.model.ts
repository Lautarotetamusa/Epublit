import {conn} from '../db.js' 
import { Cliente } from './cliente.model.js'
import { Libro } from './libro.model.js'

import { NotFound, ValidationError } from './errors.js';
import { retrieveLibro } from '../schemas/libros.schema.js';
import {  buildConsignacion, createConsignacion, saveConsignacion, createLibroConsignacion } from '../schemas/consignaciones.schema.js';
import { BaseModel } from './base.model.js';
import { retrieveLibroPersona } from '../schemas/libro_persona.schema.js';
import { TipoCliente } from '../schemas/cliente.schema.js';

/*
    crear consignacion

    await Libro.all_exists(req.libros.map(l => ({isbn: l.isbn}));
    await Cliente.exists(req.cliente);

    let consignacion = Consignacion.create(req);
    log(consignacion)
 */

export class LibroConsignacion extends Libro {
    cantidad: number;
    autores: retrieveLibroPersona[];
    ilustradores: retrieveLibroPersona[];

    static table_name = "libros_consignaciones";

    constructor(req: {libro: retrieveLibro, cantidad: number, autores: retrieveLibroPersona[], ilustradores: retrieveLibroPersona[]}){

        super(req.libro);
        
        this.cantidad = req.cantidad;
        this.autores = req.autores;
        this.ilustradores = req.ilustradores;
    }

    static async insert_i(_req: createLibroConsignacion){
        await super._bulk_insert(_req.libros.map(l => ({
            id_consignacion: _req.id, isbn: l.isbn, stock: l.cantidad, 
        })));
    }
}

export class Consignacion extends BaseModel{
    id?: number;
    file_path: string;
    libros: LibroConsignacion[];
    cliente: Cliente;

    static table_name = "consignaciones";

    constructor(req: buildConsignacion & {id?: number}){
        super();

        this.file_path = req.file_path;
        this.libros = req.libros;
        this.cliente = req.cliente;
        if ('id' in req)
            this.id = req.id;
    }

    static async set_client(id_cliente: number): Promise<Cliente>{
        console.log("cliente:", id_cliente);

        let cliente = await Cliente.get_by_id(id_cliente);

        if (cliente.tipo == TipoCliente.particular){
            throw new ValidationError("No se puede hacer una consignacion a un cliente CONSUMIDOR FINAL");
        }
        return cliente;
    }

    static async set_libros(_libros: {
        cantidad: number,
        isbn: string
    }[]): Promise<LibroConsignacion[]>{

        let libros: LibroConsignacion[] = [];
        for (let _libro of _libros) {
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

    static async build(req: createConsignacion): Promise<Consignacion>{
        let cliente = await this.set_client(req.cliente);

        let date = new Date().toISOString()
            .replace(/\..+/, '')     // delete the . and everything after;
            .replace(/T/, '_')       // replace T with a space
            .replace('/-/g', '_')
            .replace('/:/g', '');

        return new Consignacion({
            ...req,
            libros: await this.set_libros(req.libros),
            cliente: cliente,
            file_path: cliente.razon_social.replace('/-/g', '')+'_'+date+'.pdf'
        }); 
    }
    
    async save(){
        let cons = await Consignacion._insert<saveConsignacion, Consignacion>({
            id_cliente: this.cliente.id,
            remito_path: this.file_path,
        });
        this.id = cons.id;

        console.log("cons:", this);
        
        await LibroConsignacion.insert_i(this as createLibroConsignacion);
        
        for (const libro of this.libros) {
            await libro.update_stock(-libro.cantidad);
        }
        

        /*this.id = (await conn.query(`

            INSERT INTO ${table_name}
            SET id_cliente = ${this.cliente.id},
            remito_path = '${this.path}'

        `))[0].insertId;*/

        /*let libros_consignaciones = req.libros.map(l => [cons.id, l.cantidad, l.isbn]);
        await conn.query(`

            INSERT INTO libros_consignaciones
                (id_consignacion, stock, isbn)
            VALUES ? 

        `, [libros_consignaciones]);*/   
    }
}

