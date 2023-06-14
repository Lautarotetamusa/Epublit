import {conn} from "../db.js"
import {ValidationError, NotFound, NothingChanged, Duplicated} from './errors.js'
import { Libro } from "./libro.model.js";


const table_name = "personas";
const visible_fields = "id, dni, nombre, email";

//TODO: porcentaje de la persona
export class Persona {
    //Validamos al momento de crear un objeto
    constructor(persona) {
        this.nombre = persona.nombre;
        this.email  = persona.email;

        if ('dni' in persona)
            this.dni = persona.dni;
        
        if ('id' in persona)
            this.id = Number(persona.id);
    }
    
    static validate(request) {
        if (!request.nombre)
            throw new ValidationError("El nombre es obligatorio");

        if (!request.email)
            this.email = ""

        if (!request.dni)
            throw new ValidationError("El dni es obligatorio");
    }

    static async exists(dni){
        let res =  (await conn.query(`
            SELECT COUNT(id) as count from ${table_name}
            WHERE dni = ${dni}
            AND is_deleted = 0
        `))[0][0].count;
        return res > 0;
    }

    async insert() {
        if (await Persona.exists(this.dni)){
            throw new Duplicated(`La persona con dni ${this.dni} ya se encuentra cargada`);
        }

        let res = (await conn.query(`
            INSERT INTO ${table_name} SET ?`
        , this))[0];

        this.id = res.insertId;
    }

    async update(req) {
        if (req.dni && req.dni != this.dni){
            if (await Persona.exists(req.dni))
                throw new Duplicated(`La persona con dni ${req.dni} ya se encuentra cargada`);
        }

        this.nombre = req.nombre || this.nombre;
        this.email  = req.email  || this.email;
        this.dni    = req.dni    || this.dni;

        let res = (await conn.query(`
            UPDATE ${table_name} SET ?
            WHERE id=${this.id}
            AND is_deleted = 0`
        , this))[0];

        if (res.affectedRows == 0)
            throw new NotFound(`No se encuentra la persona con id ${this.id}`);

        if (res.changedRows == 0)
            throw new NothingChanged('Ningun valor es distinto a lo que ya existia en la base de datos');
    }

    static async delete(id){
        /*await conn.query(`
            DELETE FROM libros_personas
            WHERE id_persona = ${id}
        `);*/

        /*let res = (await conn.query(`
            DELETE FROM ${table_name}
            WHERE id=${id}`
        ))[0];*/

        let res = (await conn.query(`
            UPDATE ${table_name}
            SET is_deleted = 1
            WHERE id=${id}`
        ))[0];

        if (res.affectedRows == 0)
            throw new NotFound(`No se encuentra la persona con id ${id}`);
    }

    static async get_all() {
        let personas = (await conn.query(`
            SELECT ${visible_fields} FROM ${table_name} 
            WHERE is_deleted = 0
        `))[0];
            
        return personas;
    }

    static async get_all_by_tipo(tipo) {
        let personas = (await conn.query(`
            SELECT ${visible_fields} FROM ${table_name} 
            INNER JOIN libros_personas
                ON id_persona=id
            WHERE is_deleted = 0
            AND libros_personas.tipo = ${tipo}
            GROUP BY id
        `))[0];
            
        return personas;
    }

    static async get_by_id(id) {
        let response = (await conn.query(`
            SELECT ${visible_fields} FROM ${table_name} 
            WHERE id=${id}
            AND is_deleted = 0
        `))[0];

        if (!response.length)
            throw new NotFound(`La persona con id ${id} no se encontro`);

        return response[0];
    }

    static async get_libros(id){
        let libros = (await conn.query(`
            SELECT libros.*, libros_personas.tipo 
            FROM libros
            INNER JOIN libros_personas
                ON libros_personas.id_persona=${id}
            INNER JOIN ${table_name}
                ON libros.isbn = libros_personas.isbn
            WHERE personas.id=${id}
            AND personas.is_deleted = 0
        `))[0];

        return libros;
    }
}

Persona.tipos = {
    autor: 0,
    ilustrador: 1
}
Persona.str_tipos = Object.keys(Persona.tipos);






