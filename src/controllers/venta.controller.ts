import { Request, Response } from "express";
import { Venta, VentaConsignado } from "../models/venta.model";
import { facturar, getAfipClient } from "../afip/Afip";
import { tipoCliente } from "../schemas/cliente.schema";
import { Cliente, generateClientPath } from "../models/cliente.model";
import { emitirComprobante } from "../comprobantes/comprobante";
import { conn } from "../db";
import { LibroTransaccion } from "../models/transaccion.model";
import { ValidationError } from "../models/errors";
import { User } from "../models/user.model";

const ventaConsignado = async (req: Request, res: Response): Promise<Response> => {
    const connection = await conn.getConnection();
    const user = await User.getById(res.locals.user.id);

    const {libros, cliente, ...ventaBody} = VentaConsignado.parser(req.body);
    const c = await Cliente.getById(cliente, user.id);

    const librosModel = await VentaConsignado.setLibros(libros, c, user.id, {date: ventaBody.fecha_venta});
    for (const libro of librosModel){
        if (libro.stock < libro.cantidad){
            throw new ValidationError(`El libro ${libro.titulo} con isbn ${libro.isbn} no tiene suficiente stock`)
        }
    }

    if (user.punto_venta === null || user.punto_venta === undefined) {
        throw new ValidationError("Para poder vender tenés que ingresar un punto de venta, podés hacerlo en tu perfil")
    }

    try{
        await connection.beginTransaction();
        const venta = await VentaConsignado.insert({
            ...ventaBody,
            type: VentaConsignado.type,
            id_cliente: c.id,
            total: Venta.calcTotal(librosModel, ventaBody.descuento),
            file_path: generateClientPath(c.razon_social),
            user: user.id
        }, connection);

        await LibroTransaccion.save(librosModel, venta.id, connection);

        await VentaConsignado.stockMovement(librosModel, c, connection);

        //Solo facturamos para clientes que no son en negro
        if (tipoCliente[c.tipo] != tipoCliente.negro){
            const afip = getAfipClient(user).ElectronicBilling;
            if (afip === undefined) {
                throw new ValidationError("No se puede obtener el cliente de afip")
            }
            const comprobanteData = await facturar(user.punto_venta, venta, c, afip);

            emitirComprobante({
                data: {
                    venta: Object.assign({}, venta), //Copiamos la venta porque sino al llamar a parsePath no funcionaria
                    libros: librosModel,
                    cliente: c,
                    comprobante: comprobanteData
                },
                user: user,
            });
        }
        await connection.commit();
        venta.parsePath(VentaConsignado.filesFolder);

        return res.status(201).json({
            success: true,
            message: "Venta cargada correctamente",
            data: venta
        });
    }catch(err){
        await connection.rollback();
        console.log("Se realizo un rollback");
        throw err;
    }
}

export const vender = (ventaModel: typeof Venta) => {
    return async (req: Request, res: Response): Promise<Response> => {
        const connection = await conn.getConnection();
        const user = await User.getById(res.locals.user.id);

        const {libros, cliente, ...ventaBody} = ventaModel.parser(req.body);
        const c = await Cliente.getById(cliente, user.id);

        const librosModel = await ventaModel.setLibros(libros, c, user.id);
        for (const libro of librosModel){
            if (libro.stock < libro.cantidad){
                throw new ValidationError(`El libro ${libro.titulo} con isbn ${libro.isbn} no tiene suficiente stock`)
            }
        }

        if (user.punto_venta === null || user.punto_venta === undefined) {
            throw new ValidationError("Para poder vender tenés que ingresar un punto de venta, podés hacerlo en tu perfil")
        }

        try{
            await connection.beginTransaction();
            const venta = await ventaModel.insert({
                ...ventaBody,
                type: ventaModel.type,
                id_cliente: c.id,
                total: Venta.calcTotal(librosModel, ventaBody.descuento),
                file_path: generateClientPath(c.razon_social),
                user: user.id
            }, connection);
            connection.release();

            await LibroTransaccion.save(librosModel, venta.id, connection);
            connection.release();

            await ventaModel.stockMovement(librosModel, c, connection);
            connection.release();

            //Solo facturamos para clientes que no son en negro
            if (tipoCliente[c.tipo] != tipoCliente.negro){
                const afip = getAfipClient(user).ElectronicBilling;
                if (afip === undefined) {
                    throw new ValidationError("No se puede obtener el cliente de afip")
                }
                const comprobanteData = await facturar(user.punto_venta, venta, c, afip);

                emitirComprobante({
                    data: {
                        venta: Object.assign({}, venta), //Copiamos la venta porque sino al llamar a parsePath no funcionaria
                        libros: librosModel,
                        cliente: c,
                        comprobante: comprobanteData
                    },
                    user: user,
                });
            }
            await connection.commit();
            venta.parsePath(ventaModel.filesFolder);

            return res.status(201).json({
                success: true,
                message: "Venta cargada correctamente",
                data: venta
            });
        }catch(err){
            await connection.rollback();
            console.log("Se realizo un rollback");
            throw err;
        }finally{
            connection.release();
        }
    }
}

export default{
    vender,
    ventaConsignado
}
