import { Libro } from './libro.model'
import { ValidationError } from './errors';
import { LibroSchema } from '../schemas/libros.schema';
import { ConsignacionSchema, SaveConsignacion } from '../schemas/consignaciones.schema';
import { BaseModel } from './base.model';
import { PersonaLibroPersonaSchema } from '../schemas/libro_persona.schema';
import { StockCliente } from '../schemas/cliente.schema';
import { conn } from '../db';
import { RowDataPacket } from 'mysql2';

export class LibroConsignacion extends Libro {
    cantidad: number;
    autores: PersonaLibroPersonaSchema[];
    ilustradores: PersonaLibroPersonaSchema[];

    static table_name = "libros_consignaciones";

    constructor(body: {
        libro: LibroSchema, 
        cantidad: number, 
        autores: PersonaLibroPersonaSchema[], 
        ilustradores: PersonaLibroPersonaSchema[]
    }){
        super(body.libro);
        
        this.cantidad = body.cantidad;
        this.autores = body.autores;
        this.ilustradores = body.ilustradores;
    }

    static async bulk_insert(body){
       this._bulk_insert(body); 
    }

    static async setLibros(body: StockCliente): Promise<LibroConsignacion[]>{
        let libros: LibroConsignacion[] = [];
        for (const libroBody of body) {
            const libro = await Libro.getByIsbn(libroBody.isbn);
            const {autores, ilustradores} = await libro.getPersonas();

            libros.push(new LibroConsignacion({
                libro: libro,
                cantidad: libroBody.cantidad,
                autores: autores,
                ilustradores: ilustradores
            }));

            if (libro.stock < libroBody.cantidad){
                throw new ValidationError(`El libro ${libro.titulo} con isbn ${libro.isbn} no tiene suficiente stock`);
            }
        }

        return libros;        
    }
}

export class Consignacion extends BaseModel{
    static table_name = "consignaciones";

    id: number;
    remito_path: string;
    id_cliente: number;

    constructor(body: ConsignacionSchema){
        super();

        this.remito_path = body.remito_path;
        this.id = body.id;
        this.id_cliente = body.id_cliente;
    }

    static async insert(body: SaveConsignacion){
        return await Consignacion._insert<SaveConsignacion, Consignacion>(body);
    }

    static async getById(id: number){
        return await this.find_one<ConsignacionSchema, Consignacion>({id: id});
    }

    async getLibros(): Promise<LibroConsignacion[]>{
        const [libros] = await conn.query<RowDataPacket[]>(`
            SELECT libros.isbn, titulo, cantidad 
            FROM libros
            INNER JOIN libros_consignaciones
                ON libros_consignaciones.isbn = libros.isbn
            WHERE libros_consignaciones.id_consignacion = ?
        `, [this.id]);
        return libros as LibroConsignacion[];
    }

    static async getAll(){
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

