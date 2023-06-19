"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
var express_1 = __importDefault(require("express"));
var dotenv = __importStar(require("dotenv"));
var persona_routes_1 = __importDefault(require("./routes/persona.routes"));
//import libroRouter from "./routes/libro.routes";
//import ClienteRouter from "./routes/cliente.routes";
//import VentaRouter from "./routes/venta.routes";
//import ConsignacionRouter from "./routes/consignacion.routes";
dotenv.config();
exports.app = (0, express_1.default)();
var port = Number(process.env.BACK_PORT);
//Necesesario para que no tire error de   CORS
exports.app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Authorization, X-API-KEY, Origin, X-Requested-With, Content-Type, Accept, Access-Control-Allow-Request-Method');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.header('Allow', 'GET, POST, OPTIONS, PUT, DELETE');
    next();
});
exports.app.use(express_1.default.json());
exports.app.use(express_1.default.urlencoded({ extended: true, }));
exports.app.use('/persona', persona_routes_1.default);
//app.use('/libro', libroRouter);
//app.use('/cliente', ClienteRouter);
//app.use('/venta', VentaRouter);
//app.use('/consignacion', ConsignacionRouter);
//Cualquier otra ruta no especificada
exports.app.use('*', function (req, res) { return res.status(404).json({
    success: false,
    error: "Esta ruta no hace nada negro"
}); });
exports.app.listen(port, function () { return console.log("Libros Silvestres start in port ".concat(port, "!")); });
exports.app.use(function (err, req, res, next) {
    console.error("app use:", err.stack);
    res.status(500).json({
        success: false,
        error: err,
        test: "test"
    });
    next();
});
