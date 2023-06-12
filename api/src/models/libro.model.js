import {conn} from "../db.js"
import {Persona} from "./persona.model.js"
import {ValidationError, NotFound, Duplicated, NothingChanged} from './errors.js'

const table_name = "libros"
const visible_fields = "titulo, isbn, fecha_edicion, precio, stock"

export class Libro {
    constructor(libro) {
        this.titulo = libro.titulo;
        this.isbn   = libro.isbn;
        this.fecha_edicion = libro.fecha_edicion;
        this.precio = libro.precio;
        this.stock  = libro.stock || 0;
    }

    //Validate the request
    static validate(request) {
        if (!request.titulo)
            throw new ValidationError("El titulo es obligatorio")

        if (!request.isbn)
            throw new ValidationError("El isbn es obligatorio")

        if (!request.fecha_edicion)
            throw new ValidationError("La fecha de edicion es obligatoria")

        if (!('precio' in request))
            throw new ValidationError("El precio es obligatorio")
    }

    static validate_persona(persona){
        if (!('tipo' in persona)) 
            throw new ValidationError("Se debe pasar 'tipo' en todas las personas");
        
        if (!('id' in persona))
            throw new ValidationError("Se debe pasar 'id' en todas las personas");
        
        if (!Persona.str_tipos[persona.tipo])
            throw new ValidationError("Un tipo pasado no es correcto [0, 1]");
    }

    static async is_duplicated(isbn){
        let res =  (await conn.query(`
            SELECT COUNT(isbn) as count from ${table_name}
            WHERE ${table_name}.isbn = ${isbn}
            AND is_deleted = 0
        `))[0][0].count;

        console.log("RES", res);

        if (res > 0)
            throw new Duplicated(`El libro con isbn ${isbn} ya existe`);
    }

    async insert(personas) {
        await conn.query("INSERT INTO libros SET ?", this);
        await this.add_personas(personas);
    }
    
    async update(req){
        console.log("request:", req);

        this.titulo = req.titulo || this.titulo;
        this.precio = req.precio || this.precio;
        this.fecha_edicion = req.fecha_edicion || this.fecha_edicion;
        if ('stock' in req)
            this.stock = req.stock;
        console.log("libro stock", this.stock);

        let res = (await conn.query(`
            UPDATE ${table_name}
            SET ?
            WHERE isbn=${this.isbn}
            AND is_deleted = 0
        `, this))[0];

        console.log(this);

        if (res.affectedRows == 0)
            throw new NotFound(`No se encuentra el libro con isbn ${this.isbn}`);

        if (res.changedRows == 0)
            throw new NothingChanged('Ningun valor es distinto a lo que ya existia en la base de datos');
    }

    async update_stock(stock){
        await conn.query(`
            UPDATE ${table_name}
            SET stock  = ${this.stock+stock}
            WHERE isbn = ${this.isbn}
            AND is_deleted = 0
        `);
    }

    async add_personas(personas){
        for (let i in personas) {
            let persona = personas[i];

            let res = (await conn.query(`
                SELECT id_persona, tipo 
                FROM libros_personas 
                WHERE (isbn, id_persona, tipo) in ((${this.isbn}, ${persona.id}, ${persona.tipo}))`
            ))[0];

            console.log("res:", res.length);

            if (res.length > 0)
                console.log("duplicated");//throw new Duplicated(`La persona ${persona.id} ya es un ${Persona.str_tipos[persona.tipo]} del libro ${this.isbn}`);
            else
                await conn.query(`
                    INSERT INTO libros_personas 
                    SET id_persona=${persona.id},
                    porcentaje=${persona.porcentaje || 0},
                    tipo=${persona.tipo},
                    isbn=${this.isbn}
                `);
        }
    }

    async update_personas(personas){
        for (let i in personas) {
            if (personas[i].porcentaje){
                let res = (await conn.query(`
                    UPDATE libros_personas 
                    SET porcentaje = ${personas[i].porcentaje}
                    WHERE isbn=${this.isbn}
                    AND id_persona=${personas[i].id}
                    AND tipo=${personas[i].tipo}`
                ))[0];
            }
        }
    }
    
    async remove_personas(personas){
        let persona_libro = personas.map(p => `('${this.isbn}', ${p.id}, ${p.tipo})`).join(', ');  //((isbn, id, tipo), (isbn, id, tipo) ...) String

        if (personas.length > 0){
            let res = (await conn.query(`
                DELETE FROM libros_personas
                WHERE (isbn, id_persona, tipo) in (${persona_libro})`
            ))[0];

            if (res.affectedRows == 0)
                throw new NotFound(`Ninguna persona pasada trabaja en este libro con el tipo pasado`)
        }
    }

    static async delete(isbn){
        await conn.query(`
            DELETE FROM libros_personas
            WHERE isbn=${isbn}
        `);

        let res = (await conn.query(`
            UPDATE ${table_name}
            SET is_deleted = 1
            WHERE isbn=${isbn}
            AND is_deleted = 0`
        ))[0];

        if (res.affectedRows == 0)
            throw new NotFound(`No se encuentra el libro con isbn ${isbn}`);   
    }

    static async get_by_isbn(isbn) {
        let response = (await conn.query(`
            SELECT * FROM ${table_name} 
            WHERE ${table_name}.isbn = ${isbn}
        `))[0];

        if (!response.length)
            throw new NotFound(`El libro con isbn ${isbn} no se encontro`)
        
        if(response[0].is_deleted == 1)
            throw new NotFound(`El libro con isbn ${isbn} esta dado de baja`)

        return new Libro(response[0]);
    }

    async get_personas() {
        let personas = (await conn.query(`
            SELECT personas.id, dni, nombre, email, libros_personas.tipo, libros_personas.porcentaje
            FROM personas 
            INNER JOIN libros_personas
            INNER JOIN ${table_name}
                ON personas.id  = libros_personas.id_persona
            AND ${table_name}.isbn = libros_personas.isbn
            WHERE ${table_name}.isbn = ${this.isbn}
            AND ${table_name}.is_deleted = 0
        `))[0];

        this.autores      = personas.filter(p => p.tipo == Persona.tipos.autor);
        this.ilustradores = personas.filter(p => p.tipo == Persona.tipos.ilustrador);
    }

    static async get_ventas(isbn){
        let ventas = (await conn.query(`
            SELECT  
                ventas.id as id_venta, fecha, medio_pago, total, file_path,
                id_cliente
            FROM libros_ventas
            INNER JOIN ventas
                ON ventas.id = libros_ventas.id_venta
            WHERE libros_ventas.isbn = ${isbn}
        `))[0];

        return ventas;
    }


    //TODO: Se hace una consulta a la DB por libro, no se si hay otra manera más rápida de hacerlo
    static async get_all(){
        let libros = (await conn.query(`
            SELECT ${visible_fields}
            FROM ${table_name}
            WHERE is_deleted = 0
        `))[0];

        return libros;
    }
    static async get_paginated(page = 0){
        let libros_per_page = 10;

        let libros = (await conn.query(`
            SELECT ${visible_fields}
            FROM ${table_name}
            WHERE is_deleted = 0
            LIMIT ${libros_per_page}
            OFFSET ${page * libros_per_page}
        `))[0];

        return libros;
    }

}
