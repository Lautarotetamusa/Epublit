import { Request, Response } from "express";
import { LibroVenta, Venta } from "../models/venta.model.js";
import { ValidationError } from "../models/errors.js"
import { facturar } from "../afip/Afip.js";
import { createVenta } from "../schemas/venta.schema.js";
import { tipoCliente } from "../schemas/cliente.schema.js";
import { Cliente } from "../models/cliente.model.js";
import { Libro } from "../models/libro.model.js";
import { emitirComprobante } from "../comprobantes/comprobante.js";

const vender = async (req: Request, res: Response): Promise<Response> => {
    const {libros, ...ventaBody} = createVenta.parse(req.body);
    const cliente = await Cliente.getById(ventaBody.cliente);
    const librosModel = await LibroVenta.setLibros(libros);

    const venta = await Venta.insert({
        ...ventaBody,
        id_cliente: cliente.id,
        total: Venta.calcTotal(librosModel, ventaBody.descuento),
        file_path: cliente.generatePath()            
    });

    await LibroVenta.bulk_insert(libros.map(l => ({
        id_venta: venta.id, 
        ...l            
    })));

    for (const libro of libros){
        await Libro.updateStock({cantidad: -libro.cantidad, isbn: libro.isbn});
    }
    
    if (tipoCliente[cliente.tipo] != tipoCliente.negro){
        facturar(venta, cliente).then((comprobanteData) => {
            emitirComprobante({
                data: {
                    venta: venta,
                    libros: libros,
                    cliente: cliente,
                    comprobante: comprobanteData
                }
            });
        });
    }
        
    return res.status(201).json({
        success: true,
        message: "Venta cargada correctamente",
        data: venta
    });
}

const get_factura = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!id) throw new ValidationError("El id debe ser un numero");

    const venta = await Venta.getById(id);

    return res.download('facturas/'+venta.file_path);
}

const getOne = async (req: Request, res: Response): Promise<Response> => {
    const id = Number(req.params.id);
    if (!id) throw new ValidationError("El id debe ser un numero");

    const venta = await Venta.getById(id);
    return res.json(venta);
}

const getAll = async (req: Request, res: Response): Promise<Response> => {
    const ventas = await Venta.getAll();
    return res.json(ventas);
}

export default{
    vender,
    get_factura,
    getOne,
    getAll
}
