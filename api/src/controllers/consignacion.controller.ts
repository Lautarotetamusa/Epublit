import {Request, Response} from "express";
import { Cliente } from "../models/cliente.model";
import { ValidationError } from "../models/errors"

import { emitirComprobante } from "../comprobantes/comprobante"
import { tipoCliente } from "../schemas/cliente.schema";
import { conn } from "../db";
import { LibroTransaccion, Transaccion, Consignacion } from "../models/transaccion.model";
import { TipoTransaccion, createTransaccion, tipoTransaccion } from "../schemas/transaccion.schema";

const consignar = async(req: Request, res: Response): Promise<Response> => {
    const body = createTransaccion.parse(req.body);

    const cliente = await Cliente.getById(body.cliente);
    if (tipoCliente[cliente.tipo] == tipoCliente.particular){
        throw new ValidationError("No se puede hacer una consignacion a un cliente CONSUMIDOR FINAL");
    }
    const libros = await LibroTransaccion.setLibros(body.libros, res.locals.user.id);
    for (const libro of libros){
        if (libro.stock < libro.cantidad){
            throw new ValidationError(`El libro ${libro.titulo} con isbn ${libro.isbn} no tiene suficiente stock`)
        }
    }

    const transaction = await Consignacion.insert({
        type: tipoTransaccion.consignacion,
        id_cliente: body.cliente,
        file_path: cliente.generatePath(),
        user: res.locals.user.id
    }, conn);

    await LibroTransaccion.save(libros, transaction.id, conn);
        
    for (const libro of libros) {
        await libro.updateStock(-libro.cantidad, conn);
    }

    await cliente.updateStock(body.libros);

    await emitirComprobante({
        data: {
            consignacion: transaction,
            cliente: cliente,
            libros: libros
        }, 
        user: res.locals.user, 
    });

    transaction.parsePath(Consignacion.filesFolder);

    return res.status(201).json({
        success: true,
        message: "Consignacion cargada correctamente",
        data: transaction
    });
}

export const transaccion = (tipo: TipoTransaccion) => {
    return async(req: Request, res: Response): Promise<Response> => {
        const user = res.locals.user.id;

        const body = createTransaccion.parse(req.body);
        const cliente = await Cliente.getById(body.cliente);

        if(tipoCliente[cliente.tipo] == tipoCliente.particular){
            throw new ValidationError(`No se puede hacer una ${tipo} a un cliente CONSUMIDOR FINAL`);
        }

        const libros = await LibroTransaccion.setLibros(body.libros, user);
        await cliente.haveStock(body.libros);

        const transaction = await Transaccion.insert({
            type: tipo,
            id_cliente: cliente.id,
            file_path: cliente.generatePath(),
            user: user 
        }, conn);
        await LibroTransaccion.save(libros, transaction.id, conn);

        if (tipo == tipoTransaccion.ventaConsignacion){
            for (const libro of libros){
                await libro.updateStock(libro.cantidad, conn);
            }
        }
        const substactedStock = body.libros.map(l => ({cantidad: -l.cantidad, isbn: l.isbn}));
        await cliente.updateStock(substactedStock);

        return res.status(201).json({
            success: true,
            message: `Se realizó la ${tipo} correctamente`,
            data: transaction
        });
    }
}

export default{
    consignar,
    transaccion,
}
