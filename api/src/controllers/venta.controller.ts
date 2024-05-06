import { Request, Response } from "express";
import { Venta } from "../models/venta.model";
import { ValidationError } from "../models/errors"
import { facturar } from "../afip/Afip";
import { createVenta } from "../schemas/venta.schema";
import { tipoCliente } from "../schemas/cliente.schema";
import { Cliente } from "../models/cliente.model";
import { emitirComprobante } from "../comprobantes/comprobante";
import { conn } from "../db";
import { LibroTransaccion } from "../models/transaccion.model";
import { tipoTransaccion } from "../schemas/transaccion.schema";

const vender = async (req: Request, res: Response): Promise<Response> => {
    const connection = await conn.getConnection();
    const user = res.locals.user.id;

    const {libros, cliente, ...ventaBody} = createVenta.parse(req.body);
    const c = await Cliente.getById(cliente);

    const librosModel = await LibroTransaccion.setLibros(libros, user);
    for (const libro of librosModel){
        if (libro.stock < libro.cantidad){
            throw new ValidationError(`El libro ${libro.titulo} con isbn ${libro.isbn} no tiene suficiente stock`)
        }
    }

    try{
        await connection.beginTransaction();
        const venta = await Venta.insert({
            ...ventaBody,
            type: tipoTransaccion.venta,
            id_cliente: c.id,
            total: Venta.calcTotal(librosModel, ventaBody.descuento),
            file_path: c.generatePath(),
            user: user
        }, connection);
        connection.release();

        await LibroTransaccion.save(librosModel, venta.id, connection);
        connection.release();

        for (const libro of librosModel){
            await libro.updateStock(-libro.cantidad, connection);
            connection.release();
        }

        //Solo facturamos para clientes que no son en negro
        if (tipoCliente[c.tipo] != tipoCliente.negro){
            const comprobanteData = await facturar(venta, c, res.locals.user);

            emitirComprobante({
                data: {
                    venta: Object.assign({}, venta), //Copiamos la venta porque sino al llamar a parsePath no funcionaria
                    libros: librosModel,
                    cliente: c,
                    comprobante: comprobanteData
                },
                user: res.locals.user,
            });
        }
        await connection.commit();
        venta.parsePath(Venta.filesFolder);

        return res.status(201).json({
            success: true,
            message: "Venta cargada correctamente",
            data: venta
        });
    }catch(err){
        if (err instanceof Error){
            console.log("ERROR:", err.message, err.stack);
        }
        await connection.rollback();
        console.log("Se realizo un rollback");
        throw err;
    }finally{
        connection.release()
    }
}

export default{
    vender,
}
