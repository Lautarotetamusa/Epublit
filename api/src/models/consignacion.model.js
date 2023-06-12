import {conn} from '../db.js' 
import { Cliente } from './cliente.model.js'
import { Libro } from './libro.model.js'

import { NotFound, ValidationError } from './errors.js';

const table_name = 'consignaciones'

export class Consignacion{
    constructor(request){
        if (!('cliente' in request))
            throw new NotFound('el id del cliente es obligatorio');    

        if(!request.libros)
            throw new ValidationError('La consignacion necesita al menos un libro');
    }

    async set_client(req){
        console.log("cliente:", req);

        if (typeof req == Object){
            Cliente.validate(req);
            this.cliente = new Cliente(req);
            await body.cliente.insert();
        }
        else{
            this.cliente = await Cliente.get_by_id(req);
        }

        if (this.cliente.tipo == Cliente.particular){
            throw new ValidationError("No se puede hacer una consignacion a un cliente CONSUMIDOR FINAL");
        }

        let date = new Date().toISOString()
            .replace(/\..+/, '')     // delete the . and everything after;
            .replace(/T/, '_')       // replace T with a space
            .replaceAll('-', '_')
            .replaceAll(':', '');

        this.path = this.cliente.razon_social.replaceAll(' ', '')+'_'+date+'.pdf'; 
    }

    async set_libros(req){
        this.libros = [];
        for (let i in req) {
            this.libros[i] = await Libro.get_by_isbn(req[i].isbn);
            await this.libros[i].get_personas();
            this.libros[i].cantidad = req[i].cantidad;

            if (this.libros[i].stock < req[i].cantidad)
                throw new ValidationError(`El libro ${this.libros[i].titulo} con isbn ${this.libros[i].isbn} no tiene suficiente stock`);
        }

        for (const libro of this.libros) {
            await libro.update_stock(-libro.cantidad);
        }
    }
    
    async insert(){
        this.id = (await conn.query(`

            INSERT INTO ${table_name}
            SET id_cliente = ${this.cliente.id},
            remito_path = '${this.path}'

        `))[0].insertId;

        let libros_consignaciones = this.libros.map(l => [this.id, l.cantidad, l.isbn]);
        await conn.query(`

            INSERT INTO libros_consignaciones
                (id_consignacion, stock, isbn)
            VALUES ? 

        `, [libros_consignaciones]);        
    }
}

