"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LibroController = void 0;
var persona_model_js_1 = require("../models/persona.model.js");
var libro_model_js_1 = require("../models/libro.model.js");
var errors_js_1 = require("../models/errors.js");
function parse_req(body) {
    //Persona.tipos agregando 'es' al final: [autores, ilustradores]
    var tipos_keys = Object.keys(persona_model_js_1.Persona.tipos).map(function (k) { return k + "es"; });
    tipos_keys.forEach(function (tipo) {
        //Validamos que "autores" o "ilustradores" exista, si no existe le asignamos una lista vacia
        if (!body[tipo])
            body[tipo] = [];
        //Validamos que "autores" o "ilustradores" sea de tipo [], si es de tipo {} creamos una lista con un solo elemento: [{obj}]
        if (!Array.isArray(body[tipo]))
            body[tipo] = [body[tipo]];
        //Asignamos el tipo dependiendo de en que lista está, si está en "autores" o en "ilustradores"
        body[tipo].map(function (a) {
            a.tipo = tipos_keys.indexOf(tipo);
        });
    });
    //Concatenamos las dos listas y las devolvemos
    var personas = body.autores.concat(body.ilustradores);
    //Separamos los objetos que hay que crear(not_in_db) de los objetos que ya se encuentran en la DB(in_db)
    return {
        indb: personas.filter(function (p) { return "id" in p; }),
        not_indb: personas.filter(function (p) { return !("id" in p); }) //Lista de ids de las personas que ya están en la DB
    };
}
exports.LibroController = {};
exports.LibroController.create = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var personas_data, _a, indb, not_indb, i, _b, _c, _d, _i, i, persona, _e, _f, _g, _h, i, persona, libro, error_1;
    return __generator(this, function (_j) {
        switch (_j.label) {
            case 0:
                console.log(req.body);
                _j.label = 1;
            case 1:
                _j.trys.push([1, 12, , 13]);
                personas_data = [];
                libro_model_js_1.Libro.validate(req.body); //Validar la request
                return [4 /*yield*/, libro_model_js_1.Libro.is_duplicated(req.body.isbn)];
            case 2:
                _j.sent();
                _a = parse_req(req.body), indb = _a.indb, not_indb = _a.not_indb;
                //Validar los datos de las personas que no estan en la DB
                for (i in not_indb) {
                    persona_model_js_1.Persona.validate(not_indb[i]);
                }
                _b = indb;
                _c = [];
                for (_d in _b)
                    _c.push(_d);
                _i = 0;
                _j.label = 3;
            case 3:
                if (!(_i < _c.length)) return [3 /*break*/, 6];
                _d = _c[_i];
                if (!(_d in _b)) return [3 /*break*/, 5];
                i = _d;
                return [4 /*yield*/, persona_model_js_1.Persona.get_by_id(indb[i].id)];
            case 4:
                persona = _j.sent();
                persona.tipo = indb[i].tipo;
                personas_data.push(persona); //Cargar la data de las personas con esas IDs
                console.log("indb tipo:", personas_data.tipo);
                _j.label = 5;
            case 5:
                _i++;
                return [3 /*break*/, 3];
            case 6:
                _e = not_indb;
                _f = [];
                for (_g in _e)
                    _f.push(_g);
                _h = 0;
                _j.label = 7;
            case 7:
                if (!(_h < _f.length)) return [3 /*break*/, 10];
                _g = _f[_h];
                if (!(_g in _e)) return [3 /*break*/, 9];
                i = _g;
                persona = new persona_model_js_1.Persona(not_indb[i]);
                return [4 /*yield*/, persona.insert()];
            case 8:
                _j.sent();
                indb.push({ id: persona.id, tipo: not_indb[i].tipo }); //Agregar las personas cargadas a la lista de lo que ya esta en db
                _j.label = 9;
            case 9:
                _h++;
                return [3 /*break*/, 7];
            case 10:
                //Unir la lista de personas insertadas con las que ya existian
                personas_data = personas_data.concat(not_indb);
                console.log("personas_data:", personas_data);
                libro = new libro_model_js_1.Libro(req.body);
                console.log("INDB", indb);
                return [4 /*yield*/, libro.insert(indb)];
            case 11:
                _j.sent();
                return [2 /*return*/, res.status(201).json({
                        success: true,
                        message: "Libro con isbn ".concat(req.body.isbn, " creado correctamente"),
                        data: __assign(__assign({}, libro), { autores: personas_data.filter(function (p) { return p.tipo == persona_model_js_1.Persona.tipos["autor"]; }), ilustradores: personas_data.filter(function (p) { return p.tipo == persona_model_js_1.Persona.tipos["ilustrador"]; }) })
                    })];
            case 12:
                error_1 = _j.sent();
                return [2 /*return*/, (0, errors_js_1.parse_error)(res, error_1)];
            case 13: return [2 /*return*/];
        }
    });
}); };
exports.LibroController.delete = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, libro_model_js_1.Libro.delete(req.params.isbn)];
            case 1:
                _a.sent();
                return [2 /*return*/, res.json({
                        success: true,
                        message: "Libro con isbn ".concat(req.params.isbn, " eliminado correctamente")
                    })];
            case 2:
                error_2 = _a.sent();
                return [2 /*return*/, (0, errors_js_1.parse_error)(res, error_2)];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.LibroController.update = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var libro, error_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, libro_model_js_1.Libro.get_by_isbn(req.params.isbn)];
            case 1:
                libro = _a.sent();
                return [4 /*yield*/, libro.update(req.body)];
            case 2:
                _a.sent();
                return [2 /*return*/, res.status(201).json({
                        success: true,
                        message: "Libro con isbn ".concat(req.params.isbn, " actualizado correctamente"),
                        data: libro
                    })];
            case 3:
                error_3 = _a.sent();
                return [2 /*return*/, (0, errors_js_1.parse_error)(res, error_3)];
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.LibroController.manage_personas = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var personas, code, message, _a, _b, _c, _i, i, libro, _d, error_4;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                personas = Array.isArray(req.body) ? req.body : [req.body];
                code = 201;
                message = 'creada';
                _e.label = 1;
            case 1:
                _e.trys.push([1, 15, , 16]);
                _a = personas;
                _b = [];
                for (_c in _a)
                    _b.push(_c);
                _i = 0;
                _e.label = 2;
            case 2:
                if (!(_i < _b.length)) return [3 /*break*/, 5];
                _c = _b[_i];
                if (!(_c in _a)) return [3 /*break*/, 4];
                i = _c;
                libro_model_js_1.Libro.validate_persona(personas[i]);
                return [4 /*yield*/, persona_model_js_1.Persona.get_by_id(personas[i].id)];
            case 3:
                _e.sent(); //Check if the person exists
                _e.label = 4;
            case 4:
                _i++;
                return [3 /*break*/, 2];
            case 5: return [4 /*yield*/, libro_model_js_1.Libro.get_by_isbn(req.params.isbn)];
            case 6:
                libro = _e.sent();
                _d = req.method;
                switch (_d) {
                    case "POST": return [3 /*break*/, 7];
                    case "PUT": return [3 /*break*/, 9];
                    case "DELETE": return [3 /*break*/, 11];
                }
                return [3 /*break*/, 13];
            case 7: return [4 /*yield*/, libro.add_personas(personas)];
            case 8:
                _e.sent();
                return [3 /*break*/, 13];
            case 9: return [4 /*yield*/, libro.update_personas(personas)];
            case 10:
                _e.sent();
                message = 'actualizada';
                return [3 /*break*/, 13];
            case 11: return [4 /*yield*/, libro.remove_personas(personas)];
            case 12:
                _e.sent();
                message = 'borrada';
                code = 200;
                return [3 /*break*/, 13];
            case 13: return [4 /*yield*/, libro.get_personas()];
            case 14:
                _e.sent();
                return [2 /*return*/, res.status(code).json({
                        success: true,
                        message: "Personas ".concat(message, " con exito"),
                        data: libro
                    })];
            case 15:
                error_4 = _e.sent();
                return [2 /*return*/, (0, errors_js_1.parse_error)(res, error_4)];
            case 16: return [2 /*return*/];
        }
    });
}); };
exports.LibroController.get_ventas = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var ventas, error_5;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, libro_model_js_1.Libro.get_ventas(req.params.isbn)];
            case 1:
                ventas = _a.sent();
                return [2 /*return*/, res.json(ventas)];
            case 2:
                error_5 = _a.sent();
                return [2 /*return*/, (0, errors_js_1.parse_error)(res, error_5)];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.LibroController.get_one = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var libro, error_6;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, libro_model_js_1.Libro.get_by_isbn(req.params.isbn)];
            case 1:
                libro = _a.sent();
                return [4 /*yield*/, libro.get_personas()];
            case 2:
                _a.sent();
                return [2 /*return*/, res.json(libro)];
            case 3:
                error_6 = _a.sent();
                return [2 /*return*/, (0, errors_js_1.parse_error)(res, error_6)];
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.LibroController.get_all = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var libros, error_7;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 5, , 6]);
                libros = [];
                if (!("page" in req.query)) return [3 /*break*/, 2];
                return [4 /*yield*/, libro_model_js_1.Libro.get_paginated(req.query.page || 0)];
            case 1:
                libros = _a.sent();
                return [3 /*break*/, 4];
            case 2: return [4 /*yield*/, libro_model_js_1.Libro.get_all()];
            case 3:
                libros = _a.sent();
                _a.label = 4;
            case 4:
                res.json(libros);
                return [3 /*break*/, 6];
            case 5:
                error_7 = _a.sent();
                return [2 /*return*/, (0, errors_js_1.parse_error)(res, error_7)];
            case 6: return [2 /*return*/];
        }
    });
}); };
