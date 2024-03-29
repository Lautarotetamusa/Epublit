import { Cliente } from "../models/cliente.model";
import { Request, Response } from "express";
import { Duplicated, ValidationError } from '../models/errors';
import { createCliente, updateCliente } from "../schemas/cliente.schema";

async function getCliente(req: Request): Promise<Cliente>{
    const id = Number(req.params.id);
    console.log(req.params.id);

    if (req.params.id == "consumidor_final")
        return await Cliente.getConsumidorFinal();

    if (!id) throw new ValidationError("El id debe ser un numero");
    return await Cliente.getById(id);
}

const create = async (req: Request, res: Response): Promise<Response> => {
    const body = createCliente.parse(req.body);

    if(await Cliente.cuilExists(body.cuit)){
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
    const cliente = await Cliente.getById(id);
    
    if(body.cuit && body.cuit != cliente.cuit && await Cliente.cuilExists(body.cuit)){
        throw new Duplicated(`El cliente con cuit ${body.cuit} ya existe`);
    }
    
    await cliente.update(body);
    
    return res.status(201).json({
        success: true,
        message: "Cliente actualizado correctamente",
        data: cliente
    });
}

const getStock = async (req: Request, res: Response): Promise<Response> => {
    const cliente = await getCliente(req);
    let stock = await cliente.getStock();
    return res.json(stock);
}

const getVentas = async (req: Request, res: Response): Promise<Response> => {
    const cliente = await getCliente(req);
    const ventas = await cliente.getVentas(res.locals.user.id);
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

const getAll = async (req: Request, res: Response): Promise<Response> => {
    const clientes = await Cliente.getAll()
    return res.json(clientes);
}

const getOne = async (req: Request, res: Response): Promise<Response> => {
    const cliente = await getCliente(req);
    return res.json(cliente);
}

export default {
    create,
    update,
    getStock,
    getVentas,
    delet,
    getAll,
    getOne
}
