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
exports.ClienteController = void 0;
const cliente_model_js_1 = require("../models/cliente.model.js");
const errors_js_1 = require("../models/errors.js");
exports.ClienteController = {};
/*
    Request example
    {
        tipo: "inscripto",
        nombre: "Raul",
        cuit: 2043491979,
        email: "",
        cond_fiscal: 0,
    }

    {
        tipos: "particular",
        nombre: "Jose",
        email: "jose@gmail.com"
    }
*/
exports.ClienteController.create = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield cliente_model_js_1.Cliente.validate(req.body);
        let cliente = new cliente_model_js_1.Cliente(req.body);
        yield cliente.insert();
        res.status(201).json({
            success: true,
            message: "Cliente creado correctamente",
            data: cliente
        });
    }
    catch (error) { //Error handling
        return (0, errors_js_1.parse_error)(res, error);
    }
});
exports.ClienteController.update = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (Object.keys(req.body).length === 0 && req.body.constructor === Object) //Si pasamos un objeto vacio
            return res.status(204).json({
                success: false,
                message: "No hay ningun campo para actualizar",
            });
        let cliente = {};
        if (req.params.id == "consumidor_final") {
            cliente = yield cliente_model_js_1.Cliente.get_consumidor_final();
        }
        else {
            cliente = yield cliente_model_js_1.Cliente.get_by_id(req.params.id);
        }
        yield cliente.update(req.body);
        return res.status(201).json({
            success: true,
            message: "Cliente actualizado correctamente",
            data: cliente
        });
    }
    catch (error) {
        return (0, errors_js_1.parse_error)(res, error);
    }
});
exports.ClienteController.get_stock = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let cliente = {};
        if (req.params.id == "consumidor_final") {
            cliente = yield cliente_model_js_1.Cliente.get_consumidor_final();
        }
        else {
            cliente = yield cliente_model_js_1.Cliente.get_by_id(req.params.id);
        }
        let stock = yield cliente.get_stock();
        return res.json(stock);
    }
    catch (error) {
        return (0, errors_js_1.parse_error)(res, error);
    }
});
exports.ClienteController.get_ventas = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let cliente = {};
        if (req.params.id == "consumidor_final") {
            cliente = yield cliente_model_js_1.Cliente.get_consumidor_final();
        }
        else {
            cliente = yield cliente_model_js_1.Cliente.get_by_id(req.params.id);
        }
        let ventas = yield cliente.get_ventas();
        return res.json(ventas);
    }
    catch (error) {
        return (0, errors_js_1.parse_error)(res, error);
    }
});
exports.ClienteController.delet = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield cliente_model_js_1.Cliente.delete(req.params.id);
        return res.json({
            success: true,
            message: `Cliente con id ${req.params.id} eliminado correctamente`
        });
    }
    catch (error) {
        return (0, errors_js_1.parse_error)(res, error);
    }
});
exports.ClienteController.get_all = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let clientes = yield cliente_model_js_1.Cliente.get_all();
            return res.json(clientes);
        }
        catch (error) {
            return (0, errors_js_1.parse_error)(res, error);
        }
    });
};
exports.ClienteController.get_one = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let cliente = {};
            if (req.params.id == "consumidor_final") {
                cliente = yield cliente_model_js_1.Cliente.get_consumidor_final();
            }
            else {
                cliente = yield cliente_model_js_1.Cliente.get_by_id(req.params.id);
            }
            return res.json(cliente);
        }
        catch (error) {
            return (0, errors_js_1.parse_error)(res, error);
        }
    });
};
