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
exports.VentaController = void 0;
const venta_model_js_1 = require("../models/venta.model.js");
const errors_js_1 = require("../models/errors.js");
const Afip_js_1 = require("../afip/Afip.js");
exports.VentaController = {};
exports.VentaController.vender = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let body = req.body;
    try {
        venta_model_js_1.Venta.validate(body);
        const venta = new venta_model_js_1.Venta(body);
        yield venta.set_client(body.cliente);
        yield venta.set_libros(body.libros);
        console.log("venta:", venta);
        for (let i in venta.libros) {
            yield venta.libros[i].update_stock(-body.libros[i].cantidad);
        }
        yield venta.insert();
        yield (0, Afip_js_1.facturar)(venta);
        res.status(201).json(Object.assign({ success: true, message: "Venta cargada correctamente" }, venta));
    }
    catch (error) {
        return (0, errors_js_1.parse_error)(res, error);
    }
});
exports.VentaController.get_factura = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const venta = yield venta_model_js_1.Venta.get_by_id(req.params.id);
    console.log(venta.file_path);
    res.download('facturas/' + venta.file_path);
});
exports.VentaController.get_one = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let venta = yield venta_model_js_1.Venta.get_by_id(req.params.id);
        //console.log(venta);
        return res.json(venta);
    }
    catch (error) {
        return (0, errors_js_1.parse_error)(res, error);
    }
});
exports.VentaController.get_all = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let ventas = yield venta_model_js_1.Venta.get_all(req.params.id);
        //console.log(ventas);
        return res.json(ventas);
    }
    catch (error) {
        return (0, errors_js_1.parse_error)(res, error);
    }
});
