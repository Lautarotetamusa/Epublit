import {Request, Response} from "express";
import { Consignacion } from "../models/consignacion.model.js";
import { Cliente } from "../models/cliente.model.js";
import { Libro } from "../models/libro.model.js";
import { Venta } from "../models/venta.model.js";
import { ValidationError } from "../models/errors.js"

import { emitir_comprobante } from "../comprobantes/comprobante.js"
import { validateConsignacion } from "../schemas/consignaciones.schema.js";
import { TipoCliente } from "../schemas/cliente.schema.js";
import { medio_pago } from "../schemas/venta.schema.js";

const consignar = async(req: Request, res: Response): Promise<Response> => {
    let body = validateConsignacion.create(req.body);

    const consignacion = await Consignacion.build(body);
    await consignacion.save();

    console.log("user: ", res.locals.user);

    await consignacion.cliente.update_stock(body.libros);

    await emitir_comprobante({data: consignacion, user: res.locals.user, tipo:"remito"});

    return res.status(201).json({
        success: true,
        message: "Consignacion cargada correctamente",
        data: consignacion
    });
}

const get_one = async (req: Request, res: Response): Promise<Response> => {
    const id = Number(req.params.id);
    if (!id) throw new ValidationError("El id debe ser un numero");

    const cons = await Consignacion.get_by_id(id);
    return res.json(cons);
}

const get_all = async (req: Request, res: Response): Promise<Response> => {
    const cons = await Consignacion.get_all();
    return res.json(cons);
}

const get_remito = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!id) throw new ValidationError("El id debe ser un numero");

    const cons = await Consignacion.get_by_id(id);
    res.download('remitos/'+cons.remito_path);
}

const liquidar = async(req: Request, res: Response): Promise<Response> => {
    const id = Number(req.params.id);
    if (!id) throw new ValidationError("El id debe ser un numero");

    let body = validateConsignacion.create(req.body);
    let cliente = await Cliente.get_by_id(id);

    if(cliente.tipo == TipoCliente.particular){
        return res.status(400).json({
            success: false,
            error: "No se puede hacer una liquidacion a un cliente CONSUMIDOR FINAL"
        })
    }

    //Validar que los libros existan
    for (let i in body.libros) {
        let libro = await Libro.get_by_isbn(body.libros[i].isbn);
        //libros.push(libro);

        await libro.update_stock(body.libros[i].cantidad);
    }

    await cliente.have_stock(body.libros);

    //Actualizar el stock del cliente
    let substacted_stock = body.libros.map(l => ({cantidad: -l.cantidad, isbn: l.isbn}));
    console.log(substacted_stock);
    await cliente.update_stock(substacted_stock);

    const venta = Venta.build({
        ...body,
        descuento: 0,
        medio_pago: medio_pago.debito
    });

    return res.status(201).json(venta);
}

export default{
    consignar,
    liquidar,
    get_one,
    get_all,
    get_remito
}
