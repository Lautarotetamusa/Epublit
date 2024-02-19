import { Request, Response } from "express";
import { LibroVenta, Venta } from "../models/venta.model.js";
import { ValidationError } from "../models/errors.js"
import { facturar } from "../afip/Afip.js";
import { createVenta } from "../schemas/venta.schema.js";
import { tipoCliente } from "../schemas/cliente.schema.js";
import { Cliente } from "../models/cliente.model.js";
import { Libro } from "../models/libro.model.js";

const vender = async (req: Request, res: Response): Promise<Response> => {
    const {libros, ...ventaBody} = createVenta.parse(req.body);
    const cliente = await Cliente.get_by_id(ventaBody.cliente);
    const librosModel = await LibroVenta.set_libros(libros);

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
        await Libro.update_stock({cantidad: -libro.cantidad, isbn: libro.isbn});
    }
    
    if (tipoCliente[cliente.tipo] != tipoCliente.negro){
        await facturar(venta, res.locals.user);
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

    const venta = await Venta.get_by_id(id);

    return res.download('facturas/'+venta.file_path);
}

const get_one = async (req: Request, res: Response): Promise<Response> => {
    const id = Number(req.params.id);
    if (!id) throw new ValidationError("El id debe ser un numero");

    const venta = await Venta.get_by_id(id);
    return res.json(venta);
}

const get_all = async (req: Request, res: Response): Promise<Response> => {
    const ventas = await Venta.get_all();
    return res.json(ventas);
}

export default{
    vender,
    get_factura,
    get_one,
    get_all
}
