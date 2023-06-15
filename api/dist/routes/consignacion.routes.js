"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const consignacion_controller_js_1 = require("../controllers/consignacion.controller.js");
const router = express_1.default.Router();
router.post('/', consignacion_controller_js_1.ConsignacionController.consignar);
exports.default = router;
