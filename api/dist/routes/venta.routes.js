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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const venta_controller_js_1 = require("../controllers/venta.controller.js");
const venta_model_js_1 = require("../models/venta.model.js");
const router = express_1.default.Router();
router.post('/', venta_controller_js_1.VentaController.vender);
router.get('/', venta_controller_js_1.VentaController.get_all);
router.get('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (req.params.id == "medios_pago") {
        return res.json(venta_model_js_1.Venta.str_medios_pago);
    }
    venta_controller_js_1.VentaController.get_one(req, res);
}));
router.get('/:id/factura', venta_controller_js_1.VentaController.get_factura);
exports.default = router;
