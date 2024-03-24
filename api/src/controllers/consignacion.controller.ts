import {Request, Response} from "express";
import { Consignacion, LibroConsignacion } from "../models/consignacion.model";
import { Cliente } from "../models/cliente.model";
import { Venta } from "../models/venta.model";
import { ValidationError } from "../models/errors"

import { emitirComprobante } from "../comprobantes/comprobante"
import { createConsignacion } from "../schemas/consignaciones.schema";
import { tipoCliente } from "../schemas/cliente.schema";

const consignar = async(req: Request, res: Response): Promise<Response> => {
    const body = createConsignacion.parse(req.body);

    const cliente = await Cliente.getById(body.cliente);
    if (tipoCliente[cliente.tipo] == tipoCliente.particular){
        throw new ValidationError("No se puede hacer una consignacion a un cliente CONSUMIDOR FINAL");
    }
    const libros = await LibroConsignacion.setLibros(body.libros, res.locals.user.id);
    if (libros.length < body.libros.length){
        throw new ValidationError("Algun libro no existe");
    }

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
        await libro.updateStock(-libro.cantidad, res.locals.user.id);
    }

    await cliente.updateStock(body.libros);

    await emitirComprobante({
        data: {
            consignacion: consignacion,
            cliente: cliente,
            libros: libros
        }, 
        user: res.locals.user, 
    });

    consignacion.parsePath();

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

const liquidar = async(req: Request, res: Response): Promise<Response> => {
    const id = Number(req.params.id);
    const user = res.locals.user.id;

    if (!id) throw new ValidationError("El id debe ser un numero");
    const body = createConsignacion.parse(req.body);
    const cliente = await Cliente.getById(id);

    if(tipoCliente[cliente.tipo] == tipoCliente.particular){
        throw new ValidationError("No se puede hacer una liquidacion a un cliente CONSUMIDOR FINAL");
    }
    await cliente.haveStock(body.libros);

    const librosModel = await LibroConsignacion.setLibros(body.libros, user);
    if (librosModel.length < body.libros.length){
        throw new ValidationError("Algun libro no existe");
    }
    
    //Insertar la venta
    const venta = await Venta.insert({
        id_cliente: cliente.id,
        descuento: 0,
        medio_pago: "debito",
        total: 0,//Venta.calcTotal(librosModel, 0),
        file_path: cliente.generatePath(),
        user: user 
    });

    //Insertar todos los libros de esa venta
    await LibroConsignacion.bulk_insert(body.libros.map(l => ({
        id_venta: venta.id, 
        ...l            
    })));

    //Actualizar el stock del cliente y del libro
    for (const libro of librosModel){
        await libro.updateStock(libro.cantidad, res.locals.user.id);
    }
    const substactedStock = body.libros.map(l => ({cantidad: -l.cantidad, isbn: l.isbn}));
    await cliente.updateStock(substactedStock);

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
}
