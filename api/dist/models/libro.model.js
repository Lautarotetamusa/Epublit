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
exports.Libro = void 0;
var db_1 = require("../db");
var persona_model_1 = require("./persona.model");
var errors_1 = require("./errors");
var table_name = "libros";
var visible_fields = "titulo, isbn, fecha_edicion, precio, stock";
var Libro = /** @class */ (function () {
    function Libro(request) {
        this.titulo = request.titulo;
        this.isbn = request.isbn;
        this.fecha_edicion = request.fecha_edicion;
        this.precio = request.precio;
        this.stock = request.stock || 0;
    }
    //Validate the request
    Libro.validate = function (request) {
        if (!request.titulo)
            throw new errors_1.ValidationError("El titulo es obligatorio");
        if (!request.isbn)
            throw new errors_1.ValidationError("El isbn es obligatorio");
        if (!request.fecha_edicion)
            throw new errors_1.ValidationError("La fecha de edicion es obligatoria");
        if (!('precio' in request))
            throw new errors_1.ValidationError("El precio es obligatorio");
    };
    Libro.validate_persona = function (persona) {
        if (!('tipo' in persona))
            throw new errors_1.ValidationError("Se debe pasar 'tipo' en todas las personas");
        if (!('id' in persona))
            throw new errors_1.ValidationError("Se debe pasar 'id' en todas las personas");
        if (!Object.values(persona_model_1.TipoPersona).includes(persona.tipo))
            throw new errors_1.ValidationError("Un tipo pasado no es correcto [0, 1]");
    };
    Libro.is_duplicated = function (isbn) {
        return __awaiter(this, void 0, void 0, function () {
            var result, count;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.conn.query("\n            SELECT COUNT(isbn) as count from ".concat(table_name, "\n            WHERE ").concat(table_name, ".isbn = ?\n            AND is_deleted = 0\n        "), [isbn])];
                    case 1:
                        result = _a.sent();
                        count = result[0][0].count;
                        if (count > 0)
                            throw new errors_1.Duplicated("El libro con isbn ".concat(isbn, " ya existe"));
                        return [2 /*return*/];
                }
            });
        });
    };
    Libro.prototype.insert = function (personas) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.conn.query("INSERT INTO libros SET ?", this)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.add_personas(personas)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    Libro.prototype.update = function (req) {
        return __awaiter(this, void 0, void 0, function () {
            var res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("request:", req);
                        this.titulo = req.titulo || this.titulo;
                        this.precio = req.precio || this.precio;
                        this.fecha_edicion = req.fecha_edicion || this.fecha_edicion;
                        if ('stock' in req)
                            this.stock = req.stock;
                        console.log("libro stock", this.stock);
                        return [4 /*yield*/, db_1.conn.query("\n            UPDATE ".concat(table_name, "\n            SET ?\n            WHERE isbn = ?\n            AND is_deleted = 0\n        "), [this, this.isbn])];
                    case 1:
                        res = (_a.sent())[0];
                        if (res.affectedRows == 0)
                            throw new errors_1.NotFound("No se encuentra el libro con isbn ".concat(this.isbn));
                        if (res.changedRows == 0)
                            throw new errors_1.NothingChanged('Ningun valor es distinto a lo que ya existia en la base de datos');
                        return [2 /*return*/];
                }
            });
        });
    };
    Libro.prototype.update_stock = function (stock) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.conn.query("\n            UPDATE ".concat(table_name, "\n            SET stock  = ?\n            WHERE isbn = ?\n            AND is_deleted = 0\n        "), [this.stock + stock, this.isbn])];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    Libro.delete = function (isbn) {
        return __awaiter(this, void 0, void 0, function () {
            var query, res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.conn.query("\n            DELETE FROM libros_personas\n            WHERE isbn = ?\n        ", [isbn])];
                    case 1:
                        _a.sent();
                        query = "\n            UPDATE ".concat(table_name, "\n            SET is_deleted = 1\n            WHERE isbn = ?\n            AND is_deleted = 0");
                        return [4 /*yield*/, db_1.conn.query(query, [isbn])];
                    case 2:
                        res = (_a.sent())[0];
                        if (res.affectedRows == 0)
                            throw new errors_1.NotFound("No se encuentra el libro con isbn ".concat(isbn));
                        return [2 /*return*/];
                }
            });
        });
    };
    Libro.get_by_isbn = function (isbn) {
        return __awaiter(this, void 0, void 0, function () {
            var query, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = "\n            SELECT * FROM ".concat(table_name, " \n            WHERE ").concat(table_name, ".isbn = ?");
                        return [4 /*yield*/, db_1.conn.query(query, [isbn])];
                    case 1:
                        response = (_a.sent())[0];
                        if (!response.length)
                            throw new errors_1.NotFound("El libro con isbn ".concat(isbn, " no se encontro"));
                        if (response[0].is_deleted == 1)
                            throw new errors_1.NotFound("El libro con isbn ".concat(isbn, " esta dado de baja"));
                        return [2 /*return*/, new Libro(response[0])];
                }
            });
        });
    };
    Libro.prototype.get_personas = function () {
        return __awaiter(this, void 0, void 0, function () {
            var personas;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.conn.query("\n            SELECT personas.id, dni, nombre, email, libros_personas.tipo, libros_personas.porcentaje\n            FROM personas \n            INNER JOIN libros_personas\n            INNER JOIN ".concat(table_name, "\n                ON personas.id  = libros_personas.id_persona\n            AND ").concat(table_name, ".isbn = libros_personas.isbn\n            WHERE ").concat(table_name, ".isbn = ").concat(this.isbn, "\n            AND ").concat(table_name, ".is_deleted = 0\n        "))];
                    case 1:
                        personas = (_a.sent())[0];
                        this.autores = personas.filter(function (p) { return p.tipo == persona_model_1.TipoPersona.autor; });
                        this.ilustradores = personas.filter(function (p) { return p.tipo == persona_model_1.TipoPersona.ilustrador; });
                        return [2 /*return*/];
                }
            });
        });
    };
    /*static async get_ventas(isbn: string): Venta[]{
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
    }*/
    //TODO: Se hace una consulta a la DB por libro, no se si hay otra manera más rápida de hacerlo
    Libro.get_all = function () {
        return __awaiter(this, void 0, void 0, function () {
            var libros;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.conn.query("\n            SELECT ".concat(visible_fields, "\n            FROM ").concat(table_name, "\n            WHERE is_deleted = 0\n        "))];
                    case 1:
                        libros = (_a.sent())[0];
                        return [2 /*return*/, libros];
                }
            });
        });
    };
    Libro.get_paginated = function (page) {
        if (page === void 0) { page = 0; }
        return __awaiter(this, void 0, void 0, function () {
            var libros_per_page, libros;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        libros_per_page = 10;
                        return [4 /*yield*/, db_1.conn.query("\n            SELECT ".concat(visible_fields, "\n            FROM ").concat(table_name, "\n            WHERE is_deleted = 0\n            LIMIT ").concat(libros_per_page, "\n            OFFSET ").concat(page * libros_per_page, "\n        "))];
                    case 1:
                        libros = (_a.sent())[0];
                        return [2 /*return*/, libros];
                }
            });
        });
    };
    Libro.prototype.add_personas = function (personas) {
        return __awaiter(this, void 0, void 0, function () {
            var _i, personas_1, persona, query, res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _i = 0, personas_1 = personas;
                        _a.label = 1;
                    case 1:
                        if (!(_i < personas_1.length)) return [3 /*break*/, 6];
                        persona = personas_1[_i];
                        query = "\n                SELECT id_persona, tipo \n                FROM libros_personas \n                WHERE (isbn, id_persona, tipo) in ((?, ?, ?))";
                        return [4 /*yield*/, db_1.conn.query(query, [this.isbn, persona.id_persona, persona.tipo])];
                    case 2:
                        res = (_a.sent())[0];
                        console.log("res:", res.length);
                        if (!(res.length > 0)) return [3 /*break*/, 3];
                        console.log("duplicated"); //throw new Duplicated(`La persona ${persona.id} ya es un ${Persona.str_tipos[persona.tipo]} del libro ${this.isbn}`);
                        return [3 /*break*/, 5];
                    case 3: return [4 /*yield*/, db_1.conn.query("\n                    INSERT INTO libros_personas \n                    SET id_persona=".concat(persona.id_persona, ",\n                    porcentaje=").concat(persona.porcentaje || 0, ",\n                    tipo=").concat(persona.tipo, ",\n                    isbn=").concat(this.isbn, "\n                "))];
                    case 4:
                        _a.sent();
                        _a.label = 5;
                    case 5:
                        _i++;
                        return [3 /*break*/, 1];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    Libro.prototype.update_personas = function (personas) {
        return __awaiter(this, void 0, void 0, function () {
            var _i, personas_2, persona, query;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _i = 0, personas_2 = personas;
                        _a.label = 1;
                    case 1:
                        if (!(_i < personas_2.length)) return [3 /*break*/, 4];
                        persona = personas_2[_i];
                        if (!persona.porcentaje) return [3 /*break*/, 3];
                        query = "\n                    UPDATE libros_personas \n                    SET porcentaje = ?\n                    WHERE isbn = ?\n                    AND id_persona = ?\n                    AND tipo = ?";
                        return [4 /*yield*/, db_1.conn.query(query, [persona.porcentaje, persona.id_persona, persona.tipo])];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    Libro.prototype.remove_personas = function (personas) {
        return __awaiter(this, void 0, void 0, function () {
            var persona_libro, query, res;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        persona_libro = personas.map(function (p) { return "('".concat(_this.isbn, "', ").concat(p.id_persona, ", ").concat(p.tipo, ")"); }).join(', ');
                        query = "\n            DELETE FROM libros_personas\n            WHERE (isbn, id_persona, tipo) in (?)";
                        if (!(personas.length > 0)) return [3 /*break*/, 2];
                        return [4 /*yield*/, db_1.conn.query(query, [persona_libro])];
                    case 1:
                        res = (_a.sent())[0];
                        if (res.affectedRows == 0)
                            throw new errors_1.NotFound("Ninguna persona pasada trabaja en este libro con el tipo pasado");
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    };
    return Libro;
}());
exports.Libro = Libro;
