"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LibroController = void 0;
const persona_model_js_1 = require("../models/persona.model.js");
const libro_model_js_1 = require("../models/libro.model.js");
const errors_js_1 = require("../models/errors.js");
function parse_req(body) {
    //Persona.tipos agregando 'es' al final: [autores, ilustradores]
    let tipos_keys = Object.keys(persona_model_js_1.Persona.tipos).map(k => k + "es");
    tipos_keys.forEach(tipo => {
        //Validamos que "autores" o "ilustradores" exista, si no existe le asignamos una lista vacia
        if (!body[tipo])
            body[tipo] = [];
        //Validamos que "autores" o "ilustradores" sea de tipo [], si es de tipo {} creamos una lista con un solo elemento: [{obj}]
        if (!Array.isArray(body[tipo]))
            body[tipo] = [body[tipo]];
        //Asignamos el tipo dependiendo de en que lista está, si está en "autores" o en "ilustradores"
        body[tipo].map(a => {
            a.tipo = tipos_keys.indexOf(tipo);
        });
    });
    //Concatenamos las dos listas y las devolvemos
    let personas = body.autores.concat(body.ilustradores);
    //Separamos los objetos que hay que crear(not_in_db) de los objetos que ya se encuentran en la DB(in_db)
    return {
        indb: personas.filter(p => "id" in p),
        not_indb: personas.filter(p => !("id" in p)) //Lista de ids de las personas que ya están en la DB
    };
}
exports.LibroController = {};
exports.LibroController.create = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log(req.body);
    try {
        let personas_data = (Array); //Lista de personas validas y cargadas
        libro_model_js_1.Libro.validate(req.body); //Validar la request
        yield libro_model_js_1.Libro.is_duplicated(req.body.isbn);
        const { indb, not_indb } = parse_req(req.body); //Parsear la request
        //Validar los datos de las personas que no estan en la DB
        for (let i in not_indb) {
            persona_model_js_1.Persona.validate(not_indb[i]);
        }
        //Validar que los ids existan en la DB
        for (let i in indb) {
            let persona = yield persona_model_js_1.Persona.get_by_id(indb[i].id);
            persona.tipo = indb[i].tipo;
            personas_data.push(persona); //Cargar la data de las personas con esas IDs
            console.log("indb tipo:", personas_data.tipo);
        }
        //Insertar cada persona en la base de datos
        for (let i in not_indb) {
            let persona = new persona_model_js_1.Persona(not_indb[i]);
            yield persona.insert();
            indb.push({ id: persona.id, tipo: not_indb[i].tipo }); //Agregar las personas cargadas a la lista de lo que ya esta en db
        }
        //Unir la lista de personas insertadas con las que ya existian
        personas_data = personas_data.concat(not_indb);
        console.log("personas_data:", personas_data);
        //Crear el libro
        const libro = new libro_model_js_1.Libro(req.body);
        console.log("INDB", indb);
        yield libro.insert(indb);
        return res.status(201).json({
            success: true,
            message: `Libro con isbn ${req.body.isbn} creado correctamente`,
            data: Object.assign(Object.assign({}, libro), { autores: personas_data.filter(p => p.tipo == persona_model_js_1.Persona.tipos["autor"]), ilustradores: personas_data.filter(p => p.tipo == persona_model_js_1.Persona.tipos["ilustrador"]) })
        });
    }
    catch (error) {
        return (0, errors_js_1.parse_error)(res, error);
    }
});
exports.LibroController.delete = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield libro_model_js_1.Libro.delete(req.params.isbn);
        return res.json({
            success: true,
            message: `Libro con isbn ${req.params.isbn} eliminado correctamente`
        });
    }
    catch (error) {
        return (0, errors_js_1.parse_error)(res, error);
    }
});
exports.LibroController.update = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let libro = yield libro_model_js_1.Libro.get_by_isbn(req.params.isbn);
        yield libro.update(req.body);
        return res.status(201).json({
            success: true,
            message: `Libro con isbn ${req.params.isbn} actualizado correctamente`,
            data: libro
        });
    }
    catch (error) {
        return (0, errors_js_1.parse_error)(res, error);
    }
});
exports.LibroController.manage_personas = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let personas = Array.isArray(req.body) ? req.body : [req.body]; //Hacemos que personas sea un array si o si
    let code = 201;
    let message = 'creada';
    try {
        for (let i in personas) {
            libro_model_js_1.Libro.validate_persona(personas[i]);
            yield persona_model_js_1.Persona.get_by_id(personas[i].id); //Check if the person exists
        }
        let libro = yield libro_model_js_1.Libro.get_by_isbn(req.params.isbn);
        switch (req.method) {
            case "POST":
                yield libro.add_personas(personas);
                break;
            case "PUT":
                yield libro.update_personas(personas);
                message = 'actualizada';
                break;
            case "DELETE":
                yield libro.remove_personas(personas);
                message = 'borrada';
                code = 200;
                break;
        }
        yield libro.get_personas();
        return res.status(code).json({
            success: true,
            message: `Personas ${message} con exito`,
            data: libro
        });
    }
    catch (error) {
        return (0, errors_js_1.parse_error)(res, error);
    }
});
exports.LibroController.get_ventas = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let ventas = yield libro_model_js_1.Libro.get_ventas(req.params.isbn);
        return res.json(ventas);
    }
    catch (error) {
        return (0, errors_js_1.parse_error)(res, error);
    }
});
exports.LibroController.get_one = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let libro = yield libro_model_js_1.Libro.get_by_isbn(req.params.isbn);
        yield libro.get_personas();
        return res.json(libro);
    }
    catch (error) {
        return (0, errors_js_1.parse_error)(res, error);
    }
});
exports.LibroController.get_all = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let libros = [];
        if ("page" in req.query) {
            libros = yield libro_model_js_1.Libro.get_paginated(req.query.page || 0);
        }
        else {
            libros = yield libro_model_js_1.Libro.get_all();
        }
        res.json(libros);
    }
    catch (error) {
        return (0, errors_js_1.parse_error)(res, error);
    }
});
