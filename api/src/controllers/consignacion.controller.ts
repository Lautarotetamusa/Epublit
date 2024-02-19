import {Request, Response} from "express";
import { Consignacion, LibroConsignacion } from "../models/consignacion.model.js";
import { Cliente } from "../models/cliente.model.js";
import { Libro } from "../models/libro.model.js";
import { Venta } from "../models/venta.model.js";
import { ValidationError } from "../models/errors.js"

import { emitirComprobante } from "../comprobantes/comprobante.js"
import { createConsignacion } from "../schemas/consignaciones.schema.js";
import { tipoCliente } from "../schemas/cliente.schema.js";
import { medioPago } from "../schemas/venta.schema.js";

const consignar = async(req: Request, res: Response): Promise<Response> => {
    const body = createConsignacion.parse(req.body);

    const cliente = await Cliente.getById(body.cliente);
    if (tipoCliente[cliente.tipo] == tipoCliente.particular){
        throw new ValidationError("No se puede hacer una consignacion a un cliente CONSUMIDOR FINAL");
    }

    const libros = await LibroConsignacion.setLibros(body.libros);
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
        await Libro.updateStock({isbn: libro.isbn, cantidad: -libro.cantidad});
    }

    await cliente.updateStock(body.libros);

    await emitirComprobante({
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

const getOne = async (req: Request, res: Response): Promise<Response> => {
    const id = Number(req.params.id);
    if (!id) throw new ValidationError("El id debe ser un numero");

    const cons = await Consignacion.getById(id);
    return res.json(cons);
}

const getAll = async (req: Request, res: Response): Promise<Response> => {
    const cons = await Consignacion.getAll();
    return res.json(cons);
}

const getRemito = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!id) throw new ValidationError("El id debe ser un numero");

    const cons = await Consignacion.getById(id);
    res.download('remitos/'+cons.remito_path);
}

const liquidar = async(req: Request, res: Response): Promise<Response> => {
    const id = Number(req.params.id);
    if (!id) throw new ValidationError("El id debe ser un numero");
    const body = createConsignacion.parse(req.body);
    const cliente = await Cliente.getById(id);

    if(tipoCliente[cliente.tipo] == tipoCliente.particular){
        throw new ValidationError("No se puede hacer una liquidacion a un cliente CONSUMIDOR FINAL");
    }

    if (!(await Libro.all_exists(body.libros))){
        throw new ValidationError("Algun libro no existe");
    }

    await cliente.haveStock(body.libros);
    
    //Actualizar el stock del cliente y del libro
    for (const libroBody of body.libros){
        await Libro.updateStock(libroBody);
    }
    const substactedStock = body.libros.map(l => ({cantidad: -l.cantidad, isbn: l.isbn}));
    await cliente.updateStock(substactedStock);

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
    getOne,
    getAll,
    getRemito
}
