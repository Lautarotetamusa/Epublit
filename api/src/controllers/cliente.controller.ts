import { Cliente } from "../models/cliente.model";
import { Request, Response } from "express";
import { Duplicated, ValidationError } from '../models/errors';
import { createCliente, updateCliente } from "../schemas/cliente.schema";

async function get_client(req: Request): Promise<Cliente>{
    const id = Number(req.params.id);

    if (req.params.id == "consumidor_final")
        return await Cliente.get_consumidor_final();

    if (!id) throw new ValidationError("El id debe ser un numero");
    return await Cliente.get_by_id(id);
}

const create = async (req: Request, res: Response): Promise<Response> => {
    const body = createCliente.parse(req.body);

    if(await Cliente.cuil_exists(body.cuit)){
        throw new Duplicated(`El cliente con cuit ${body.cuit} ya existe`)
    }

    const cliente = await Cliente.insert(body);

    return res.status(201).json({
        success: true,
        message: "Cliente creado correctamente",
        data: cliente
    });
}

const update = async (req: Request, res: Response): Promise<Response> => {
    const id = Number(req.params.id);
    if (!id) throw new ValidationError("El id debe ser un numero");

    const body = updateCliente.parse(req.body); 
    const cliente = await Cliente.get_by_id(id);
    
    if(body.cuit && body.cuit != cliente.cuit && await Cliente.cuil_exists(body.cuit)){
        throw new Duplicated(`El cliente con cuit ${body.cuit} ya existe`);
    }
    
    await cliente.update(body);
    
    return res.status(201).json({
        success: true,
        message: "Cliente actualizado correctamente",
        data: cliente
    });
}

const get_stock = async (req: Request, res: Response): Promise<Response> => {
    const cliente = await get_client(req);
    let stock = await cliente.get_stock();
    return res.json(stock);
}

const get_ventas = async (req: Request, res: Response): Promise<Response> => {
    const cliente = await get_client(req);
    const ventas = await cliente.get_ventas();
    return res.json(ventas);
}


const delet = async (req: Request, res: Response): Promise<Response> => {
    const id = Number(req.params.id);
    if (!id) throw new ValidationError("El id debe ser un numero");

    await Cliente.delete(id)

    return res.json({
        success: true,
        message: `Cliente con id ${id} eliminado correctamente`
    });
}

const get_all = async (req: Request, res: Response): Promise<Response> => {
    const clientes = await Cliente.get_all()
    return res.json(clientes);
}

const get_one = async (req: Request, res: Response): Promise<Response> => {
    const cliente = await get_client(req);
    return res.json(cliente);
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
