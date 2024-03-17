import { Request, Response } from "express";
import { LibroVenta, Venta } from "../models/venta.model";
import { ValidationError } from "../models/errors"
import { facturar } from "../afip/Afip";
import { createVenta } from "../schemas/venta.schema";
import { tipoCliente } from "../schemas/cliente.schema";
import { Cliente } from "../models/cliente.model";
import { emitirComprobante } from "../comprobantes/comprobante";

const vender = async (req: Request, res: Response): Promise<Response> => {
    const {libros, ...ventaBody} = createVenta.parse(req.body);
    const cliente = await Cliente.getById(ventaBody.cliente);

    const librosModel = await LibroVenta.setLibros(libros);
    if (librosModel.length < libros.length){
        throw new ValidationError("Algun libro no existe");
    }

    await cliente.haveStock(libros);

    const venta = await Venta.insert({
        descuento: ventaBody.descuento,
        medio_pago: ventaBody.medio_pago,
        id_cliente: cliente.id,
        total: Venta.calcTotal(librosModel, ventaBody.descuento),
        file_path: cliente.generatePath()            
    });

    await LibroVenta.save(librosModel, venta.id);

    for (const libro of librosModel){
        await libro.updateStock(libro.cantidad);
    }
    
    //Solo facturamos para clientes que no son en negro
    if (tipoCliente[cliente.tipo] != tipoCliente.negro){
        facturar(venta, cliente).then((comprobanteData) => {
            emitirComprobante({
                data: {
                    venta: venta,
                    libros: librosModel,
                    cliente: cliente,
                    comprobante: comprobanteData
                },
                user: res.locals.user,
            });
        });
    }
    venta.parsePath();
        
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
