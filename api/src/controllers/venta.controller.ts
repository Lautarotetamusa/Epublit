import { Request, Response } from "express";
import { Venta } from "../models/venta.model.js";
import { ValidationError } from "../models/errors.js"
import { facturar } from "../afip/Afip.js";
import { validateVenta } from "../schemas/venta.schema.js";
import { TipoCliente } from "../schemas/cliente.schema.js";

const vender = async (req: Request, res: Response): Promise<Response> => {
    const body = validateVenta.create(req.body);

    const venta = await Venta.build(body);
    
    if (venta.cliente.tipo != TipoCliente.negro){
        await facturar(venta, res.locals.user);
    }

    await venta.save();
        
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
