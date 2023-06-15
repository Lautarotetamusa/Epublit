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
exports.ConsignacionController = void 0;
const consignacion_model_js_1 = require("../models/consignacion.model.js");
const cliente_model_js_1 = require("../models/cliente.model.js");
const libro_model_js_1 = require("../models/libro.model.js");
const venta_model_js_1 = require("../models/venta.model.js");
const errors_js_1 = require("../models/errors.js");
const comprobante_js_1 = require("../comprobantes/comprobante.js");
exports.ConsignacionController = {};
exports.ConsignacionController.consignar = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let body = req.body;
    try {
        const consignacion = new consignacion_model_js_1.Consignacion(body);
        yield consignacion.set_client(body.cliente);
        yield consignacion.set_libros(body.libros);
        yield consignacion.cliente.update_stock(body.libros);
        yield consignacion.insert();
        console.log("consignacion:", consignacion);
        yield (0, comprobante_js_1.emitir_comprobante)(consignacion, "remito");
        res.status(201).json(Object.assign({ success: true, message: "Consignacion cargada correctamente" }, consignacion));
    }
    catch (error) {
        return (0, errors_js_1.parse_error)(res, error);
    }
});
exports.ConsignacionController.liquidar = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let libros = [];
    let cliente;
    try {
        req.body.cliente = yield cliente_model_js_1.Cliente.get_by_id(req.params.id);
        if (req.body.cliente.tipo == cliente_model_js_1.Cliente.particular) {
            return res.status(400).json({
                success: false,
                error: "No se puede hacer una liquidacion a un cliente CONSUMIDOR FINAL"
            });
        }
        //Validar que los libros existan
        for (let i in req.body.libros) {
            libros[i] = yield libro_model_js_1.Libro.get_by_isbn(req.body.libros[i].isbn);
            yield libros[i].update_stock(req.body.libros[i].cantidad);
        }
        yield req.body.cliente.have_stock(req.body.libros);
        //Actualizar el stock del cliente
        let substacted_stock = req.body.libros.map(l => ({ cantidad: -l.cantidad, isbn: l.isbn }));
        console.log(substacted_stock);
        yield req.body.cliente.update_stock(substacted_stock);
        const venta = new venta_model_js_1.Venta(req.body);
        res.status(201).json(venta);
    }
    catch (error) {
        return (0, errors_js_1.parse_error)(res, error);
    }
});
