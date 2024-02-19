import {Request, Response} from "express";
import { Consignacion, LibroConsignacion } from "../models/consignacion.model.js";
import { Cliente } from "../models/cliente.model.js";
import { Libro } from "../models/libro.model.js";
import { Venta } from "../models/venta.model.js";
import { ValidationError } from "../models/errors.js"

import { emitir_comprobante } from "../comprobantes/comprobante.js"
import { createConsignacion } from "../schemas/consignaciones.schema.js";
import { tipoCliente } from "../schemas/cliente.schema.js";
import { medioPago } from "../schemas/venta.schema.js";

const consignar = async(req: Request, res: Response): Promise<Response> => {
    const body = createConsignacion.parse(req.body);

    const cliente = await Cliente.get_by_id(body.cliente);
    if (tipoCliente[cliente.tipo] == tipoCliente.particular){
        throw new ValidationError("No se puede hacer una consignacion a un cliente CONSUMIDOR FINAL");
    }

    const libros = await LibroConsignacion.set_libros(body.libros);
    const consignacion = await Consignacion.insert({
        id_cliente: body.cliente,
        remito_path: cliente.generatePath()
    });

    await LibroConsignacion.bulk_insert(body.libros.map(l => ({
        id_consignacion: consignacion.id, 
        isbn: l.isbn, 
        cantidad: l.cantidad, 
    })));
        
    for (const libro of libros) {
        await Libro.update_stock({isbn: libro.isbn, cantidad: -libro.cantidad});
    }

    await cliente.update_stock(body.libros);

    await emitir_comprobante({
        data: {
            consignacion: consignacion,
            cliente: cliente,
            libros: libros
        }, 
        user: res.locals.user, 
        tipo:"remito"
    });

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
    const body = createConsignacion.parse(req.body);
    const cliente = await Cliente.get_by_id(id);

    if(tipoCliente[cliente.tipo] == tipoCliente.particular){
        throw new ValidationError("No se puede hacer una liquidacion a un cliente CONSUMIDOR FINAL");
    }

    if (!(await Libro.all_exists(body.libros))){
        throw new ValidationError("Algun libro no existe");
    }

    await cliente.have_stock(body.libros);
    
    //Actualizar el stock del cliente y del libro
    for (const libroBody of body.libros){
        await Libro.update_stock(libroBody);
    }
    const substacted_stock = body.libros.map(l => ({cantidad: -l.cantidad, isbn: l.isbn}));
    await cliente.update_stock(substacted_stock);

    const venta = await Venta.build({
        ...body,
        descuento: 0,
        medio_pago: medioPago.debito
    });
    await venta.save();

    return res.status(201).json({
        success: true,
        message: "Se liquido la consignacion correctamente",
        data: venta
    });
}

export default{
    consignar,
    liquidar,
    get_one,
    get_all,
    get_remito
}
