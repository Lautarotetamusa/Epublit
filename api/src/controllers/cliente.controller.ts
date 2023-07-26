import { Cliente } from "../models/cliente.model";
import { Request, Response } from "express";
import { Duplicated, ValidationError, parse_error } from '../models/errors';
import { validateCliente } from "../schemas/cliente.schema";

const create = async (req: Request, res: Response): Promise<Response> => {
     try {
        let body = validateCliente.create(req.body);

        if(await Cliente.cuil_exists(body.cuit))
            throw new Duplicated(`El cliente con cuit ${body.cuit} ya existe`)

        const cliente = await Cliente.insert(body);

        return res.status(201).json({
            success: true,
            message: "Cliente creado correctamente",
            data: cliente
        });
    } catch (error: any) { //Error handling
        return parse_error(res, error); 
    }
}

const update = async (req: Request, res: Response): Promise<Response> => {
    const id = Number(req.params.id);

    try {
        if (!id) throw new ValidationError("El id debe ser un numero");

        let body = validateCliente.update(req.body);
        console.log("body:", body);

        if (Object.keys(req.body).length === 0 && req.body.constructor === Object) //Si pasamos un objeto vacio
            return res.status(204).json({
                success: false,
                message: "No hay ningun campo para actualizar",
            });

        const cliente = await Cliente.get_by_id(id);

        console.log("body:", body);
        
        if(body.cuit && await Cliente.cuil_exists(body.cuit))
            throw new Duplicated(`El cliente con cuit ${body.cuit} ya existe`);
        
        await cliente.update(body);
        
        return res.status(201).json({
            success: true,
            message: "Cliente actualizado correctamente",
            data: cliente
        })
    } catch (error: any) {
        return parse_error(res, error);
    }
}

const get_stock = async (req: Request, res: Response): Promise<Response> => {
    const id = Number(req.params.id);
    
    try {
        if (!id) throw new ValidationError("El id debe ser un numero");

        let cliente: any;
        if (req.params.id == "consumidor_final"){
            cliente = await Cliente.get_consumidor_final();
        }else{
            cliente = await Cliente.get_by_id(id);
        }
        
        let stock = await cliente.get_stock();
        return res.json(stock)

    } catch (error: any) {
        return parse_error(res, error);
    }
}

const get_ventas = async (req: Request, res: Response): Promise<Response> => {
    const id = Number(req.params.id);

    try {
        if (!id) throw new ValidationError("El id debe ser un numero");

        let cliente: Cliente;
        if (req.params.id == "consumidor_final"){
            cliente = await Cliente.get_consumidor_final();
        }else{
            cliente = await Cliente.get_by_id(id);
        }
        
        const ventas = await cliente.get_ventas();
        return res.json(ventas)
    } catch (error: any) {
        return parse_error(res, error);
    }
}


const delet = async (req: Request, res: Response): Promise<Response> => {
    const id = Number(req.params.id);

    try {
        if (!id) throw new ValidationError("El id debe ser un numero");

        await Cliente.delete(id)

        return res.json({
            success: true,
            message: `Cliente con id ${id} eliminado correctamente`
        })

    } catch (error: any) {
        return parse_error(res, error); 
    }
}

const get_all = async (req: Request, res: Response): Promise<Response> => {
    try {
        let clientes = await Cliente.get_all()
        return res.json(clientes);
    } catch (error: any) {
        return parse_error(res, error);
    }
}

const get_one = async (req: Request, res: Response): Promise<Response> => {
    const id = Number(req.params.id);

    try {
        let cliente = {};
        if (req.params.id == "consumidor_final"){
            cliente = await Cliente.get_consumidor_final();
        }else{
            if (!id) throw new ValidationError("El id debe ser un numero");

            cliente = await Cliente.get_by_id(id);
        }

        return res.json(cliente);
    } catch (error: any) {
        return parse_error(res, error); 
    }
}

export default {
    create,
    update,
    get_stock,
    get_ventas,
    delet,
    get_all,
    get_one
}