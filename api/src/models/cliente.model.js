import {conn} from '../db.js'
import {ValidationError, NotFound, NothingChanged, Duplicated} from './errors.js';
import afip from "../afip/Afip.js"

const table_name = "clientes"

export class Cliente{
    static particular = 0;
    static inscripto  = 1;

    constructor(request){
        if ('id' in request)
            this.id = request.id;

        this.nombre = request.nombre;
        this.email  = request.email;

        this.cuit = request.cuit;

        this.razon_social = request.razon_social || "";
        this.domicilio    = request.domicilio || "";
        this.cond_fiscal  = request.cond_fiscal || "";
    }

    static async validate(request) {
        if(('tipo' in request))
            if(request.tipo == Cliente.particular)
                throw new ValidationError("No se puede crear un cliente de tipo consumidor final");

        if (!request.nombre)
            throw new ValidationError("El nombre es obligatorio");

        if (!('email' in request))
            this.email = ""

        if (!('cuit' in request))
            throw new ValidationError("El cuit es obligatorio para los clientes inscriptos");

        if (await Cliente.cuil_exists(request.cuit))
            throw new Duplicated(`Ya existe un cliente con cuit ${request.cuit}`)
    }
    
    async set_afip_data(afip_data){
        console.log("afip_data:", JSON.stringify(afip_data, null, 4));

        if (!afip_data.datosGenerales.domicilioFiscal.localidad)
            afip_data.datosGenerales.domicilioFiscal.localidad = 'CAPITAL FEDERAL'

        let impuestos = null;
        if (afip_data.datosRegimenGeneral)
            impuestos = afip_data.datosRegimenGeneral.impuesto
        else if(afip_data.datosMonotributo)
            impuestos = afip_data.datosMonotributo.impuesto

        var iva = impuestos.find(i => i.idImpuesto == 32);
        if (iva)
            this.cond_fiscal = iva.descripcionImpuesto;

        if (afip_data.datosGenerales.tipoPersona == 'JURIDICA')
            this.razon_social = afip_data.datosGenerales.razonSocial;
        else 
            this.razon_social = afip_data.datosGenerales.nombre+' '+afip_data.datosGenerales.apellido;

        this.domicilio = ''
            + afip_data.datosGenerales.domicilioFiscal.direccion+' - '
            + afip_data.datosGenerales.domicilioFiscal.localidad+ ' ' 
            + afip_data.datosGenerales.domicilioFiscal.descripcionProvincia;
    }

    static async cuil_exists(cuit){
        let res = (await conn.query(`

            SELECT COUNT(id) as count FROM ${table_name}
            WHERE cuit=${cuit}
            AND tipo=${Cliente.inscripto}`
            
        ))[0][0].count;
        return res > 0;
    }

    async insert() {
        const afip_data = await afip.RegisterScopeFive.getTaxpayerDetails(this.cuit);
        if (afip_data === null)
            throw new NotFound(`La persona con CUIT ${this.cuit} no está cargada en afip`);

        this.set_afip_data(afip_data);
        this.tipo = Cliente.inscripto;

        let res = (await conn.query(`
            INSERT INTO ${table_name} SET ?`
        , this))[0];

        this.id = res.insertId;
    }

    async update(data) {
        if (this.tipo == Cliente.particular)
            throw new ValidationError("No se puede actualizar un cliente CONSUMIDOR FINAL");

        if ('cuit' in data){
            if (data.cuit != this.cuit){
                const afip_data = await afip.RegisterScopeFive.getTaxpayerDetails(data.cuit);
                if (afip_data === null)
                    throw new NotFound(`La persona con CUIT ${data.cuit} no está cargada en afip`);
            
                this.set_afip_data(afip_data);
            }
        }

        this.cuit   = data.cuit     || this.cuit;
        this.nombre = data.nombre   || this.nombre;
        this.email  = data.email    || this.email;
        this.tipo = Cliente.inscripto;

        let res = (await conn.query(`
            UPDATE ${table_name} SET ?
            WHERE id=${this.id}`
        , this))[0];

        if (res.changedRows == 0)
            throw new NothingChanged('Ningun valor es distinto a lo que ya existia en la base de datos');
    }

    static async delete(id){
        let res = (await conn.query(`
            DELETE FROM ${table_name}
            WHERE id=${id}`
        ))[0];

        if (res.affectedRows == 0)
            throw new NotFound(`No se encuentra el cliente con id ${id}`);
    }

    async get_stock(){
        let res = (await conn.query(`

            SELECT 
                titulo, libros.isbn, sc.stock
            FROM stock_cliente as sc
            INNER JOIN libros
                ON libros.isbn = sc.isbn
            WHERE id_cliente=${this.id}

        `))[0];
        return res;
    }

    async get_ventas(){
        let res = (await conn.query(`

            SELECT 
                id, fecha, total, file_path
            FROM ventas
            WHERE id_cliente=${this.id}

        `))[0];
        return res;
    }

    async update_stock(libros){
        let stock_clientes = libros.map(l => [this.id, l.cantidad, l.isbn])
        await conn.query(`

            INSERT INTO stock_cliente
                (id_cliente, stock, isbn)
                VALUES ?
            ON DUPLICATE KEY UPDATE
                stock = stock + VALUES(stock)

        `, [stock_clientes]);
    }

    async have_stock(libros){
        for (let libro of libros){
            let count = (await conn.query(`

                SELECT COUNT(*) as count FROM stock_cliente
                WHERE id_cliente=${this.id}
                AND isbn = ${libro.isbn}
                AND stock < ${libro.cantidad};

            `))[0][0].count;

            if (count > 0){
                throw new NotFound(`No hay suficiente stock del libro ${libro.isbn} para el cliente ${this.nombre} (${this.id})`);
            }
        }
    }

    static async get_all() {
        let clientes = (await conn.query(`
            SELECT * FROM ${table_name}
        `))[0];
            
        return clientes;
    }

    static async get_by_id(id) {
        let response = (await conn.query(`
            SELECT * FROM ${table_name} 
            WHERE id=${id}
        `))[0];

        if (!response.length)
            throw new NotFound(`El cliente con id ${id} no se encontro`);

        return new Cliente(response[0]);
    }

    static async get_consumidor_final(){
        let response = (await conn.query(`
            SELECT * FROM ${table_name} 
            WHERE tipo=${Cliente.particular}
        `))[0];

        if (response.length > 1)
            throw new NotFound("Hay más de un cliente CONSUMIDOR FINAL, algo anda muy mal viejo");

        return new Cliente(response[0]);
    }
}

Cliente.tipos = [
    "particular",
    "inscripto"
]

Cliente.ValidationError = ValidationError;
Cliente.NotFound = NotFound;
Cliente.NothingChanged = NothingChanged;

