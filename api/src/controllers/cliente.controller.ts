import { Cliente } from "../models/cliente.model";
import { Request, Response } from "express";
import { Duplicated, ValidationError } from '../models/errors';
import { createCliente, updateCliente } from "../schemas/cliente.schema";
import { getAfipData } from "../afip/Afip";
import { z } from "zod";

async function getCliente(req: Request, userId: number): Promise<Cliente>{
    const id = Number(req.params.id);
    console.log(req.params.id);

    if (req.params.id == "consumidor_final")
        return await Cliente.getConsumidorFinal();

    if (!id) throw new ValidationError("El id debe ser un numero");
    return await Cliente.getById(id, userId);
}

const create = async (req: Request, res: Response): Promise<Response> => {
    const body = createCliente.parse(req.body);

    if (body.cuit == res.locals.user.cuit){
        throw new ValidationError("No podes cargarte a vos mismo como cliente");
    }

    if(await Cliente.cuilExists(body.cuit, res.locals.user.id)){
        throw new Duplicated(`El cliente con cuit ${body.cuit} ya existe`)
    }

    const afipData = await getAfipData(body.cuit);
    const cliente = await Cliente.insert(body, afipData, res.locals.user.id);

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
    const cliente = await Cliente.getById(id, res.locals.user.id);
    
    if(body.cuit && body.cuit != cliente.cuit && await Cliente.cuilExists(body.cuit, res.locals.user.id)){
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
    const query = z.object({fecha: z.coerce.date().optional()}).parse(req.query)
    const cliente = await getCliente(req, res.locals.user.id);
    const libros = await cliente.getLibros(query.fecha);
    return res.json(libros);
}

const updatePrecios = async (req: Request, res: Response): Promise<Response> => {
    const cliente = await getCliente(req, res.locals.user.id);
    await cliente.updatePrecios();
    const libros = await cliente.getLibros();
    return res.json({
        success: true,
        message: `Libros del cliente ${cliente.id} actualizados correctamente`,
        data: libros
    });
}

const getVentas = async (req: Request, res: Response): Promise<Response> => {
    const cliente = await getCliente(req, res.locals.user.id);
    const ventas = await cliente.getVentas();
    return res.json(ventas);
}

const delet = async (req: Request, res: Response): Promise<Response> => {
    const id = Number(req.params.id);
    if (!id) throw new ValidationError("El id debe ser un numero");

    await Cliente.delete(id, res.locals.user.id)

    return res.json({
        success: true,
        message: `Cliente con id ${id} eliminado correctamente`
    });
}

const getAll = async (req: Request, res: Response): Promise<Response> => {
    const parse = createCliente.shape.tipo.safeParse(req.query.tipo);
    const tipo = parse.success ? parse.data : undefined;

    const clientes = await Cliente.getAll(res.locals.user.id, tipo)
    return res.json(clientes);
}

const getOne = async (req: Request, res: Response): Promise<Response> => {
    const cliente = await getCliente(req, res.locals.user.id);
    return res.json(cliente);
}

export default {
    create,
    update,
    getStock,
    updatePrecios,
    getVentas,
    delet,
    getAll,
    getOne
}
