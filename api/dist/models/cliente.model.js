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
exports.Cliente = void 0;
const db_js_1 = require("../db.js");
const errors_js_1 = require("./errors.js");
const Afip_js_1 = __importDefault(require("../afip/Afip.js"));
const table_name = "clientes";
class Cliente {
    constructor(request) {
        if ('id' in request)
            this.id = request.id;
        this.nombre = request.nombre;
        this.email = request.email;
        this.cuit = request.cuit;
        this.razon_social = request.razon_social || "";
        this.domicilio = request.domicilio || "";
        this.cond_fiscal = request.cond_fiscal || "";
    }
    static validate(request) {
        return __awaiter(this, void 0, void 0, function* () {
            if (('tipo' in request))
                if (request.tipo == Cliente.particular)
                    throw new errors_js_1.ValidationError("No se puede crear un cliente de tipo consumidor final");
            if (!request.nombre)
                throw new errors_js_1.ValidationError("El nombre es obligatorio");
            if (!('email' in request))
                this.email = "";
            if (!('cuit' in request))
                throw new errors_js_1.ValidationError("El cuit es obligatorio para los clientes inscriptos");
            if (yield Cliente.cuil_exists(request.cuit))
                throw new errors_js_1.Duplicated(`Ya existe un cliente con cuit ${request.cuit}`);
        });
    }
    set_afip_data(afip_data) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("afip_data:", JSON.stringify(afip_data, null, 4));
            if (!afip_data.datosGenerales.domicilioFiscal.localidad)
                afip_data.datosGenerales.domicilioFiscal.localidad = 'CAPITAL FEDERAL';
            let impuestos = null;
            if (afip_data.datosRegimenGeneral)
                impuestos = afip_data.datosRegimenGeneral.impuesto;
            else if (afip_data.datosMonotributo)
                impuestos = afip_data.datosMonotributo.impuesto;
            var iva = impuestos.find(i => i.idImpuesto == 32);
            if (iva)
                this.cond_fiscal = iva.descripcionImpuesto;
            if (afip_data.datosGenerales.tipoPersona == 'JURIDICA')
                this.razon_social = afip_data.datosGenerales.razonSocial;
            else
                this.razon_social = afip_data.datosGenerales.nombre + ' ' + afip_data.datosGenerales.apellido;
            this.domicilio = ''
                + afip_data.datosGenerales.domicilioFiscal.direccion + ' - '
                + afip_data.datosGenerales.domicilioFiscal.localidad + ' '
                + afip_data.datosGenerales.domicilioFiscal.descripcionProvincia;
        });
    }
    static cuil_exists(cuit) {
        return __awaiter(this, void 0, void 0, function* () {
            let res = (yield db_js_1.conn.query(`

            SELECT COUNT(id) as count FROM ${table_name}
            WHERE cuit=${cuit}
            AND tipo=${Cliente.inscripto}`))[0][0].count;
            return res > 0;
        });
    }
    insert() {
        return __awaiter(this, void 0, void 0, function* () {
            const afip_data = yield Afip_js_1.default.RegisterScopeFive.getTaxpayerDetails(this.cuit);
            if (afip_data === null)
                throw new errors_js_1.NotFound(`La persona con CUIT ${this.cuit} no está cargada en afip`);
            this.set_afip_data(afip_data);
            this.tipo = Cliente.inscripto;
            let res = (yield db_js_1.conn.query(`
            INSERT INTO ${table_name} SET ?`, this))[0];
            this.id = res.insertId;
        });
    }
    update(data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.tipo == Cliente.particular)
                throw new errors_js_1.ValidationError("No se puede actualizar un cliente CONSUMIDOR FINAL");
            if ('cuit' in data) {
                if (data.cuit != this.cuit) {
                    const afip_data = yield Afip_js_1.default.RegisterScopeFive.getTaxpayerDetails(data.cuit);
                    if (afip_data === null)
                        throw new errors_js_1.NotFound(`La persona con CUIT ${data.cuit} no está cargada en afip`);
                    this.set_afip_data(afip_data);
                }
            }
            this.cuit = data.cuit || this.cuit;
            this.nombre = data.nombre || this.nombre;
            this.email = data.email || this.email;
            this.tipo = Cliente.inscripto;
            let res = (yield db_js_1.conn.query(`
            UPDATE ${table_name} SET ?
            WHERE id=${this.id}`, this))[0];
            if (res.changedRows == 0)
                throw new errors_js_1.NothingChanged('Ningun valor es distinto a lo que ya existia en la base de datos');
        });
    }
    static delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            let res = (yield db_js_1.conn.query(`
            DELETE FROM ${table_name}
            WHERE id=${id}`))[0];
            if (res.affectedRows == 0)
                throw new errors_js_1.NotFound(`No se encuentra el cliente con id ${id}`);
        });
    }
    get_stock() {
        return __awaiter(this, void 0, void 0, function* () {
            let res = (yield db_js_1.conn.query(`

            SELECT 
                titulo, libros.isbn, sc.stock
            FROM stock_cliente as sc
            INNER JOIN libros
                ON libros.isbn = sc.isbn
            WHERE id_cliente=${this.id}

        `))[0];
            return res;
        });
    }
    get_ventas() {
        return __awaiter(this, void 0, void 0, function* () {
            let res = (yield db_js_1.conn.query(`

            SELECT 
                id, fecha, total, file_path
            FROM ventas
            WHERE id_cliente=${this.id}

        `))[0];
            return res;
        });
    }
    update_stock(libros) {
        return __awaiter(this, void 0, void 0, function* () {
            let stock_clientes = libros.map(l => [this.id, l.cantidad, l.isbn]);
            yield db_js_1.conn.query(`

            INSERT INTO stock_cliente
                (id_cliente, stock, isbn)
                VALUES ?
            ON DUPLICATE KEY UPDATE
                stock = stock + VALUES(stock)

        `, [stock_clientes]);
        });
    }
    have_stock(libros) {
        return __awaiter(this, void 0, void 0, function* () {
            for (let libro of libros) {
                let count = (yield db_js_1.conn.query(`

                SELECT COUNT(*) as count FROM stock_cliente
                WHERE id_cliente=${this.id}
                AND isbn = ${libro.isbn}
                AND stock < ${libro.cantidad};

            `))[0][0].count;
                if (count > 0) {
                    throw new errors_js_1.NotFound(`No hay suficiente stock del libro ${libro.isbn} para el cliente ${this.nombre} (${this.id})`);
                }
            }
        });
    }
    static get_all() {
        return __awaiter(this, void 0, void 0, function* () {
            let clientes = (yield db_js_1.conn.query(`
            SELECT * FROM ${table_name}
        `))[0];
            return clientes;
        });
    }
    static get_by_id(id) {
        return __awaiter(this, void 0, void 0, function* () {
            let response = (yield db_js_1.conn.query(`
            SELECT * FROM ${table_name} 
            WHERE id=${id}
        `))[0];
            if (!response.length)
                throw new errors_js_1.NotFound(`El cliente con id ${id} no se encontro`);
            return new Cliente(response[0]);
        });
    }
    static get_consumidor_final() {
        return __awaiter(this, void 0, void 0, function* () {
            let response = (yield db_js_1.conn.query(`
            SELECT * FROM ${table_name} 
            WHERE tipo=${Cliente.particular}
        `))[0];
            if (response.length > 1)
                throw new errors_js_1.NotFound("Hay más de un cliente CONSUMIDOR FINAL, algo anda muy mal viejo");
            return new Cliente(response[0]);
        });
    }
}
exports.Cliente = Cliente;
Cliente.particular = 0;
Cliente.inscripto = 1;
Cliente.tipos = [
    "particular",
    "inscripto"
];
Cliente.ValidationError = errors_js_1.ValidationError;
Cliente.NotFound = errors_js_1.NotFound;
Cliente.NothingChanged = errors_js_1.NothingChanged;
