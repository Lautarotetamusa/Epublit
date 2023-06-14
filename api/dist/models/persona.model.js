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
exports.Persona = void 0;
var db_js_1 = require("../db.js");
var errors_js_1 = require("./errors.js");
var table_name = "personas";
var visible_fields = "id, dni, nombre, email";
//TODO: porcentaje de la persona
var Persona = /** @class */ (function () {
    //Validamos al momento de crear un objeto
    function Persona(persona) {
        this.nombre = persona.nombre;
        this.email = persona.email;
        if ('dni' in persona)
            this.dni = persona.dni;
        if ('id' in persona)
            this.id = Number(persona.id);
    }
    Persona.validate = function (request) {
        if (!request.nombre)
            throw new errors_js_1.ValidationError("El nombre es obligatorio");
        if (!request.email)
            this.email = "";
        if (!request.dni)
            throw new errors_js_1.ValidationError("El dni es obligatorio");
    };
    Persona.exists = function (dni) {
        return __awaiter(this, void 0, void 0, function () {
            var res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_js_1.conn.query("\n            SELECT COUNT(id) as count from ".concat(table_name, "\n            WHERE dni = ").concat(dni, "\n            AND is_deleted = 0\n        "))];
                    case 1:
                        res = (_a.sent())[0][0].count;
                        return [2 /*return*/, res > 0];
                }
            });
        });
    };
    Persona.prototype.insert = function () {
        return __awaiter(this, void 0, void 0, function () {
            var res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Persona.exists(this.dni)];
                    case 1:
                        if (_a.sent()) {
                            throw new errors_js_1.Duplicated("La persona con dni ".concat(this.dni, " ya se encuentra cargada"));
                        }
                        return [4 /*yield*/, db_js_1.conn.query("\n            INSERT INTO ".concat(table_name, " SET ?"), this)];
                    case 2:
                        res = (_a.sent())[0];
                        this.id = res.insertId;
                        return [2 /*return*/];
                }
            });
        });
    };
    Persona.prototype.update = function (req) {
        return __awaiter(this, void 0, void 0, function () {
            var res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(req.dni && req.dni != this.dni)) return [3 /*break*/, 2];
                        return [4 /*yield*/, Persona.exists(req.dni)];
                    case 1:
                        if (_a.sent())
                            throw new errors_js_1.Duplicated("La persona con dni ".concat(req.dni, " ya se encuentra cargada"));
                        _a.label = 2;
                    case 2:
                        this.nombre = req.nombre || this.nombre;
                        this.email = req.email || this.email;
                        this.dni = req.dni || this.dni;
                        return [4 /*yield*/, db_js_1.conn.query("\n            UPDATE ".concat(table_name, " SET ?\n            WHERE id=").concat(this.id, "\n            AND is_deleted = 0"), this)];
                    case 3:
                        res = (_a.sent())[0];
                        if (res.affectedRows == 0)
                            throw new errors_js_1.NotFound("No se encuentra la persona con id ".concat(this.id));
                        if (res.changedRows == 0)
                            throw new errors_js_1.NothingChanged('Ningun valor es distinto a lo que ya existia en la base de datos');
                        return [2 /*return*/];
                }
            });
        });
    };
    Persona.delete = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_js_1.conn.query("\n            UPDATE ".concat(table_name, "\n            SET is_deleted = 1\n            WHERE id=").concat(id))];
                    case 1:
                        res = (_a.sent())[0];
                        if (res.affectedRows == 0)
                            throw new errors_js_1.NotFound("No se encuentra la persona con id ".concat(id));
                        return [2 /*return*/];
                }
            });
        });
    };
    Persona.get_all = function () {
        return __awaiter(this, void 0, void 0, function () {
            var personas;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_js_1.conn.query("\n            SELECT ".concat(visible_fields, " FROM ").concat(table_name, " \n            WHERE is_deleted = 0\n        "))];
                    case 1:
                        personas = (_a.sent())[0];
                        return [2 /*return*/, personas];
                }
            });
        });
    };
    Persona.get_all_by_tipo = function (tipo) {
        return __awaiter(this, void 0, void 0, function () {
            var personas;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_js_1.conn.query("\n            SELECT ".concat(visible_fields, " FROM ").concat(table_name, " \n            INNER JOIN libros_personas\n                ON id_persona=id\n            WHERE is_deleted = 0\n            AND libros_personas.tipo = ").concat(tipo, "\n            GROUP BY id\n        "))];
                    case 1:
                        personas = (_a.sent())[0];
                        return [2 /*return*/, personas];
                }
            });
        });
    };
    Persona.get_by_id = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_js_1.conn.query("\n            SELECT ".concat(visible_fields, " FROM ").concat(table_name, " \n            WHERE id=").concat(id, "\n            AND is_deleted = 0\n        "))];
                    case 1:
                        response = (_a.sent())[0];
                        if (!response.length)
                            throw new errors_js_1.NotFound("La persona con id ".concat(id, " no se encontro"));
                        return [2 /*return*/, response[0]];
                }
            });
        });
    };
    Persona.get_libros = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var libros;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_js_1.conn.query("\n            SELECT libros.*, libros_personas.tipo \n            FROM libros\n            INNER JOIN libros_personas\n                ON libros_personas.id_persona=".concat(id, "\n            INNER JOIN ").concat(table_name, "\n                ON libros.isbn = libros_personas.isbn\n            WHERE personas.id=").concat(id, "\n            AND personas.is_deleted = 0\n        "))];
                    case 1:
                        libros = (_a.sent())[0];
                        return [2 /*return*/, libros];
                }
            });
        });
    };
    return Persona;
}());
exports.Persona = Persona;
Persona.tipos = {
    autor: 0,
    ilustrador: 1
};
Persona.str_tipos = Object.keys(Persona.tipos);
