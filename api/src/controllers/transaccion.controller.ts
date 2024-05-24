import {Request, Response} from "express";
import { ValidationError } from "../models/errors"
import { ITransaccion, LibroTransaccion, Transaccion } from "../models/transaccion.model";
import { createTransaccion } from "../schemas/transaccion.schema";
import { Cliente } from "../models/cliente.model";
import { tipoCliente } from "../schemas/cliente.schema";
import { conn } from "../db";
import { emitirComprobante } from "../comprobantes/comprobante";

const getOne = (transaccion: typeof Transaccion) => {
    return async (req: Request, res: Response): Promise<Response> => {
        const id = Number(req.params.id);
        if (!id) throw new ValidationError("El id debe ser un numero");

        const t = await transaccion.getById(id);
        console.log(t);
        const libros = await t.getLibros();
        return res.json({
            ...t,
            libros: libros
        });
    }
}

const getAll = (transaccion: typeof Transaccion) => {
    return async (_: Request, res: Response): Promise<Response> => {
        const t = await transaccion.getAll(res.locals.user.id);
        return res.json(t);
    }
}   

export const transaccion = (transaccion: typeof Transaccion) => {
    return async(req: Request, res: Response): Promise<Response> => {
        const connection = await conn.getConnection();

        const user = res.locals.user.id;
        const body = createTransaccion.parse(req.body);
        const cliente = await Cliente.getById(body.cliente);
    
        try{
            await connection.beginTransaction();

            if (!transaccion.clientValidation(cliente.tipo)){
                throw new ValidationError(`No se le puede hacer una ${transaccion.type} a un cliente de tipo ${cliente.tipo}`);
            }

            const libros = await transaccion.setLibros(body.libros, cliente, user);
            for (const libro of libros){
                if (libro.stock < libro.cantidad){
                    throw new ValidationError(`El libro ${libro.titulo} con isbn ${libro.isbn} no tiene suficiente stock`)
                }
            }

            const transaction = await Transaccion.insert({
                type: transaccion.type,
                id_cliente: cliente.id,
                file_path: cliente.generatePath(),
                user: user 
            }, connection);
            await LibroTransaccion.save(libros, transaction.id, connection);
            connection.release();

            await transaccion.stockMovement(libros, cliente, connection);
            connection.release();
            emitirComprobante({
                data: {
                    consignacion: Object.assign({}, transaction),
                    cliente: cliente,
                    libros: libros
                }, 
                user: user, 
            });
            transaction.parsePath(transaccion.filesFolder);
            await connection.commit();

            return res.status(201).json({
                success: true,
                message: `Se realizó la ${transaccion.type} correctamente`,
                data: transaction
            });
        }catch(err){
            await connection.rollback();
            console.log("Se realizo un rollback");
            throw err;
        }finally{
            connection.release()
        }
    }
};

export default{
    getOne,
    getAll,
    transaccion
}
