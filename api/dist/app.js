"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
var express_1 = require("express");
var dotenv_1 = require("dotenv");
//import personaRouter from "./routes/persona.routes";
var libro_routes_1 = require("./routes/libro.routes");
//import ClienteRouter from "./routes/cliente.routes";
//import VentaRouter from "./routes/venta.routes";
//import ConsignacionRouter from "./routes/consignacion.routes";
dotenv_1.default.config();
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
//app.use('/persona', personaRouter);
exports.app.use('/libro', libro_routes_1.default);
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
