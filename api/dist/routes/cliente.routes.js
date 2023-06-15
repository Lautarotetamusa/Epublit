"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cliente_controller_1 = require("../controllers/cliente.controller");
const consignacion_controller_1 = require("../controllers/consignacion.controller");
const router = express_1.default.Router();
router.post('/', cliente_controller_1.ClienteController.create);
router.get('/', cliente_controller_1.ClienteController.get_all);
router.get('/:id/stock', cliente_controller_1.ClienteController.get_stock);
router.get('/:id/ventas', cliente_controller_1.ClienteController.get_ventas);
router.post('/:id/liquidacion', consignacion_controller_1.ConsignacionController.liquidar);
router.get('/:id', cliente_controller_1.ClienteController.get_one);
router.put('/:id', cliente_controller_1.ClienteController.update);
router.delete('/:id', cliente_controller_1.ClienteController.delet);
exports.default = router;
