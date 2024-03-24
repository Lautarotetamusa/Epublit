import { Request, Response } from "express";
import { LibroVenta, Venta } from "../models/venta.model";
import { ValidationError } from "../models/errors"
import { facturar } from "../afip/Afip";
import { createVenta } from "../schemas/venta.schema";
import { tipoCliente } from "../schemas/cliente.schema";
import { Cliente } from "../models/cliente.model";
import { emitirComprobante } from "../comprobantes/comprobante";
import { conn } from "../db";

const vender = async (req: Request, res: Response): Promise<Response> => {
    const connection = await conn.getConnection();
    const user = res.locals.user.id;

    const {libros, cliente, ...ventaBody} = createVenta.parse(req.body);
    const c = await Cliente.getById(cliente);

    const librosModel = await LibroVenta.setLibros(libros, user);
    if (librosModel.length < libros.length){
        throw new ValidationError("Algun libro no existe");
    }

    await c.haveStock(libros);

    try{
        await connection.beginTransaction();
        const venta = await Venta.insert({
            ...ventaBody,
            id_cliente: c.id,
            total: Venta.calcTotal(librosModel, ventaBody.descuento),
            file_path: c.generatePath(),
            user: user
        });

        await LibroVenta.save(librosModel, venta.id);

        for (const libro of librosModel){
            await libro.updateStock(libro.cantidad, user);
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
        venta.parsePath();

        return res.status(201).json({
            success: true,
            message: "Venta cargada correctamente",
            data: venta
        });
    }catch(err){
        if (err instanceof Error){
            console.log("ERROR:", err.message);
        }
        connection.rollback();
        console.log("Se realizo un rollback");
        throw err;
    }
}

const getOne = async (req: Request, res: Response): Promise<Response> => {
    const id = Number(req.params.id);
    if (!id) throw new ValidationError("El id debe ser un numero");

    const venta = await Venta.getById(id, res.locals.user.id);
    return res.json(venta);
}

const getAll = async (req: Request, res: Response): Promise<Response> => {
    const ventas = await Venta.getAll(res.locals.user.id);
    return res.json(ventas);
}

export default{
    vender,
    getOne,
    getAll
}
