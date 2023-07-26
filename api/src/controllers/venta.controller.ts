import { Request, Response } from "express";
import { Venta } from "../models/venta.model.js";
import { ValidationError, parse_error } from "../models/errors.js"
import { facturar } from "../afip/Afip.js";
import { validateVenta } from "../schemas/venta.schema.js";
import { TipoCliente } from "../schemas/cliente.schema.js";

const vender = async (req: Request, res: Response): Promise<Response> => {
    try {
        let body = validateVenta.create(req.body);
    
        const venta = await Venta.build(body);
        venta.save();
    
        console.log("venta:", venta);

        if (venta.cliente.tipo != TipoCliente.negro)
            await facturar(venta);
        else
            console.log("No se emite factura para cliente en negro");
            
        return res.status(201).json({
            success: true,
            message: "Venta cargada correctamente",
            ...venta
        });

    } catch (error: any) {
        return parse_error(res, error);
    }
}

const get_factura = async (req: Request, res: Response) => {
    const id = Number(req.params.id);

    try {
        if (!id) throw new ValidationError("El id debe ser un numero");

        const venta = await Venta.get_by_id(id);

        console.log(venta.file_path);

        res.download('facturas/'+venta.file_path);
    } catch (error: any) {
        return parse_error(res, error);   
    }
}

const get_one = async (req: Request, res: Response): Promise<Response> => {
    const id = Number(req.params.id);

    try {
        if (!id) throw new ValidationError("El id debe ser un numero");

        let venta = await Venta.get_by_id(id);
        //console.log(venta);
        return res.json(venta);
    } catch (error: any) {
        return parse_error(res, error);
    }
}

const get_all = async (req: Request, res: Response): Promise<Response> => {
    try {
        let ventas = await Venta.get_all();
        return res.json(ventas);
    } catch (error: any) {
        return parse_error(res, error);
    }
}

export default{
    vender,
    get_factura,
    get_one,
    get_all
}