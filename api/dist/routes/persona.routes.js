"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = __importDefault(require("express"));
var persona_controller_1 = __importDefault(require("../controllers/persona.controller"));
var router = express_1.default.Router();
router.post('/', persona_controller_1.default.create);
router.get('/', persona_controller_1.default.get_all);
router.get('/:id', persona_controller_1.default.get_one);
router.put('/:id', persona_controller_1.default.update);
router.delete('/:id', persona_controller_1.default.remove);
exports.default = router;
