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
var persona_model_1 = require("../models/persona.model");
var errors_1 = require("../models/errors");
var create = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var body, persona, response, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                body = req.body;
                persona_model_1.Persona.validate(body);
                persona = new persona_model_1.Persona(body);
                return [4 /*yield*/, persona.insert()];
            case 1:
                _a.sent();
                response = {
                    success: true,
                    message: "Persona creada correctamente",
                    data: persona
                };
                return [2 /*return*/, res.status(201).json(response)];
            case 2:
                error_1 = _a.sent();
                return [2 /*return*/, (0, errors_1.parse_error)(res, error_1)];
            case 3: return [2 /*return*/];
        }
    });
}); };
var update = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var body, id, persona, _a, response, error_2;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                body = req.body;
                id = Number(req.params.id);
                _b.label = 1;
            case 1:
                _b.trys.push([1, 4, , 5]);
                _a = persona_model_1.Persona.bind;
                return [4 /*yield*/, persona_model_1.Persona.get_by_id(id)];
            case 2:
                persona = new (_a.apply(persona_model_1.Persona, [void 0, _b.sent()]))();
                if (Object.keys(persona).length === 0 && persona.constructor === Object) //Si persona es un objeto vacio
                    return [2 /*return*/, res.status(204).json({
                            success: true,
                            message: "No hay ningun campo para actualizar",
                        })];
                return [4 /*yield*/, persona.update(req.body)];
            case 3:
                _b.sent();
                response = {
                    success: true,
                    message: "Persona creada correctamente",
                    data: persona
                };
                return [2 /*return*/, res.status(201).json(response)];
            case 4:
                error_2 = _b.sent();
                return [2 /*return*/, (0, errors_1.parse_error)(res, error_2)];
            case 5: return [2 /*return*/];
        }
    });
}); };
var remove = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var response, error_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, persona_model_1.Persona.delete(Number(req.params.id))];
            case 1:
                _a.sent();
                response = {
                    success: true,
                    message: "Persona con id ".concat(req.params.id, " eliminada correctamente")
                };
                return [2 /*return*/, res.json(response)];
            case 2:
                error_3 = _a.sent();
                return [2 /*return*/, (0, errors_1.parse_error)(res, error_3)];
            case 3: return [2 /*return*/];
        }
    });
}); };
var get_all = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var params, personas, tipo, error_4;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                params = req.query;
                _a.label = 1;
            case 1:
                _a.trys.push([1, 6, , 7]);
                if (!('tipo' in params)) return [3 /*break*/, 3];
                tipo = String(req.query.tipo);
                if (!(Object.values(persona_model_1.TipoPersona).includes(tipo)))
                    return [2 /*return*/, res.status(400).json({
                            success: false,
                            message: "El tipo pasado no es correcto (".concat(persona_model_1.TipoPersona, ")")
                        })];
                return [4 /*yield*/, persona_model_1.Persona.get_all_by_tipo(persona_model_1.TipoPersona[tipo])];
            case 2:
                personas = _a.sent();
                return [3 /*break*/, 5];
            case 3: return [4 /*yield*/, persona_model_1.Persona.get_all()];
            case 4:
                personas = _a.sent();
                _a.label = 5;
            case 5: return [2 /*return*/, res.json(personas)];
            case 6:
                error_4 = _a.sent();
                return [2 /*return*/, (0, errors_1.parse_error)(res, error_4)];
            case 7: return [2 /*return*/];
        }
    });
}); };
var get_one = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var params, persona, _a, error_5;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                params = req.params;
                if (!params.id)
                    return [2 /*return*/, res.status(400).json({
                            success: false,
                            message: "Se nececita pasar un id"
                        })];
                _b.label = 1;
            case 1:
                _b.trys.push([1, 4, , 5]);
                return [4 /*yield*/, persona_model_1.Persona.get_by_id(Number(params.id))];
            case 2:
                persona = _b.sent();
                _a = persona;
                return [4 /*yield*/, persona_model_1.Persona.get_libros(Number(params.id))];
            case 3:
                _a.libros = _b.sent();
                res.json(persona);
                return [3 /*break*/, 5];
            case 4:
                error_5 = _b.sent();
                return [2 /*return*/, (0, errors_1.parse_error)(res, error_5)];
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.default = {
    create: create,
    update: update,
    remove: remove,
    get_all: get_all,
    get_one: get_one
};
