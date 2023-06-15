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
exports.Venta = void 0;
const db_js_1 = require("../db.js");
const libro_model_js_1 = require("./libro.model.js");
const cliente_model_js_1 = require("./cliente.model.js");
const errors_js_1 = require("./errors.js");
const table_name = 'ventas';
class Venta {
    constructor(request) {
        this.descuento = request.descuento || 0;
        this.medio_pago = request.medio_pago;
        this.tipo = Venta.str_medios_pago[request.medio_pago];
        this.punto_venta = 4;
        this.tipo_cbte = 11;
        this.cliente = request.cliente;
        this.libros = request.libros;
    }
    static validate(request) {
        if (!('medio_pago' in request))
            throw new errors_js_1.ValidationError('El medio de pago es obligatorio para la Venta');
        if (!request.libros)
            throw new errors_js_1.ValidationError('La Venta necesita al menos un libro');
        if (!request.cliente)
            throw new errors_js_1.ValidationError('La Venta necesita un cliente');
        if (!(Object.keys(Venta.medios_pago)[request.medio_pago]))
            throw new errors_js_1.ValidationError('El medio de pago es incorrecto [0..4]');
    }
    set_client(req) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof req == Object) {
                cliente_model_js_1.Cliente.validate(req);
                this.cliente = new cliente_model_js_1.Cliente(req);
                yield body.cliente.insert();
            }
            else {
                this.cliente = yield cliente_model_js_1.Cliente.get_by_id(req);
            }
            let date = new Date().toISOString()
                .replace(/\..+/, '') // delete the . and everything after;
                .replace(/T/, '_') // replace T with a space
                .replaceAll('-', '_')
                .replaceAll(':', '');
            this.path = this.cliente.nombre.replaceAll(' ', '') + '_' + date + '.pdf';
        });
    }
    set_libros(req) {
        return __awaiter(this, void 0, void 0, function* () {
            this.libros = [];
            for (let i in req) {
                this.libros[i] = yield libro_model_js_1.Libro.get_by_isbn(req[i].isbn);
                this.libros[i].cantidad = req[i].cantidad;
                if (this.libros[i].stock < req[i].cantidad)
                    throw new errors_js_1.ValidationError(`El libro ${this.libros[i].titulo} con isbn ${this.libros[i].isbn} no tiene suficiente stock`);
            }
            this.total = this.libros.reduce((acumulador, libro) => acumulador + libro.cantidad * libro.precio, 0);
            this.total -= (this.total * this.descuento * 0.01);
            this.total = parseFloat(this.total.toFixed(2));
            console.log("total:", this.total);
        });
    }
    insert() {
        return __awaiter(this, void 0, void 0, function* () {
            let venta = (yield db_js_1.conn.query(`
            INSERT INTO ${table_name}
                (id_cliente, descuento, medio_pago, total, file_path) 
            VALUES 
                (${this.cliente.id}, ${this.descuento}, '${this.medio_pago}', ${this.total}, '${this.path}')
        `))[0];
            this.id = venta.insertId;
            let libros_venta = this.libros.map(l => [venta.insertId, l.cantidad, l.isbn, l.precio]);
            console.log(libros_venta);
            yield db_js_1.conn.query(`
            INSERT INTO libros_ventas
                (id_venta, cantidad, isbn, precio_venta)
            VALUES ? 
        `, [libros_venta]);
        });
    }
    static get_by_id(id) {
        return __awaiter(this, void 0, void 0, function* () {
            let res = (yield db_js_1.conn.query(`
            SELECT * FROM ventas
            WHERE id=${id}
        `))[0];
            if (res.length <= 0)
                throw new errors_js_1.NotFound(`No se encontro la venta con id ${id}`);
            let venta = res[0];
            let libros = (yield db_js_1.conn.query(`
            SELECT libros.isbn, titulo, cantidad, precio_venta 
            FROM libros
            INNER JOIN libros_ventas
                ON libros_ventas.isbn = libros.isbn
            INNER JOIN ventas
                ON ventas.id = libros_ventas.id_venta
            WHERE ventas.id = ${id}
        `))[0];
            let clientes = (yield db_js_1.conn.query(`
            SELECT cuit, nombre, email, tipo, cond_fiscal 
            FROM clientes
            INNER JOIN ventas
                ON ventas.id_cliente = clientes.id
            WHERE ventas.id = ${id}
        `))[0];
            console.log(libros);
            console.log(clientes);
            venta.libros = libros;
            venta.clientes = clientes;
            return venta;
        });
    }
    static get_all() {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield db_js_1.conn.query(`
            SELECT 
                ventas.id, fecha, medio_pago, total, file_path,
                cuit, nombre as nombre_cliente, email, cond_fiscal, tipo
            FROM ventas
            INNER JOIN clientes
                ON ventas.id_cliente = clientes.id
        `))[0];
        });
    }
}
exports.Venta = Venta;
Venta.medios_pago = {
    efectivo: 0,
    debito: 1,
    credito: 2,
    mercadopago: 3,
    transferencia: 4,
};
Venta.str_medios_pago = [
    "efectivo",
    "debito",
    "credito",
    "mercadopago",
    "transferencia"
];
