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
exports.Consignacion = void 0;
const db_js_1 = require("../db.js");
const cliente_model_js_1 = require("./cliente.model.js");
const libro_model_js_1 = require("./libro.model.js");
const errors_js_1 = require("./errors.js");
const table_name = 'consignaciones';
class Consignacion {
    constructor(request) {
        if (!('cliente' in request))
            throw new errors_js_1.NotFound('el id del cliente es obligatorio');
        if (!request.libros)
            throw new errors_js_1.ValidationError('La consignacion necesita al menos un libro');
    }
    set_client(req) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("cliente:", req);
            if (typeof req == Object) {
                cliente_model_js_1.Cliente.validate(req);
                this.cliente = new cliente_model_js_1.Cliente(req);
                yield body.cliente.insert();
            }
            else {
                this.cliente = yield cliente_model_js_1.Cliente.get_by_id(req);
            }
            if (this.cliente.tipo == cliente_model_js_1.Cliente.particular) {
                throw new errors_js_1.ValidationError("No se puede hacer una consignacion a un cliente CONSUMIDOR FINAL");
            }
            let date = new Date().toISOString()
                .replace(/\..+/, '') // delete the . and everything after;
                .replace(/T/, '_') // replace T with a space
                .replaceAll('-', '_')
                .replaceAll(':', '');
            this.path = this.cliente.razon_social.replaceAll(' ', '') + '_' + date + '.pdf';
        });
    }
    set_libros(req) {
        return __awaiter(this, void 0, void 0, function* () {
            this.libros = [];
            for (let i in req) {
                this.libros[i] = yield libro_model_js_1.Libro.get_by_isbn(req[i].isbn);
                yield this.libros[i].get_personas();
                this.libros[i].cantidad = req[i].cantidad;
                if (this.libros[i].stock < req[i].cantidad)
                    throw new errors_js_1.ValidationError(`El libro ${this.libros[i].titulo} con isbn ${this.libros[i].isbn} no tiene suficiente stock`);
            }
            for (const libro of this.libros) {
                yield libro.update_stock(-libro.cantidad);
            }
        });
    }
    insert() {
        return __awaiter(this, void 0, void 0, function* () {
            this.id = (yield db_js_1.conn.query(`

            INSERT INTO ${table_name}
            SET id_cliente = ${this.cliente.id},
            remito_path = '${this.path}'

        `))[0].insertId;
            let libros_consignaciones = this.libros.map(l => [this.id, l.cantidad, l.isbn]);
            yield db_js_1.conn.query(`

            INSERT INTO libros_consignaciones
                (id_consignacion, stock, isbn)
            VALUES ? 

        `, [libros_consignaciones]);
        });
    }
}
exports.Consignacion = Consignacion;
