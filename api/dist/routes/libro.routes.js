"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const libro_controller_js_1 = require("../controllers/libro.controller.js");
const router = express_1.default.Router();
// Create new libro
router.post('/', libro_controller_js_1.LibroController.create);
router.get('', libro_controller_js_1.LibroController.get_all); //paginated
router.get('/:isbn', libro_controller_js_1.LibroController.get_one);
router.get('/:isbn/ventas', libro_controller_js_1.LibroController.get_ventas);
router.put('/:isbn', libro_controller_js_1.LibroController.update);
router.delete('/:isbn', libro_controller_js_1.LibroController.delete);
//Personas del libro
router.post('/:isbn/personas', libro_controller_js_1.LibroController.manage_personas);
router.put('/:isbn/personas', libro_controller_js_1.LibroController.manage_personas);
router.delete('/:isbn/personas', libro_controller_js_1.LibroController.manage_personas);
exports.default = router;
