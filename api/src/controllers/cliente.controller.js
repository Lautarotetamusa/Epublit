import { Cliente } from "../models/cliente.model.js";
import {parse_error} from '../models/errors.js';

export const ClienteController = {};

/*
    Request example
    {
        tipo: "inscripto",
        nombre: "Raul",
        cuit: 2043491979,
        email: "",
        cond_fiscal: 0,
    }

    {
        tipos: "particular",
        nombre: "Jose",
        email: "jose@gmail.com"
    }
*/
ClienteController.create = async (req, res) => {
     try {
        await Cliente.validate(req.body);

        let cliente = new Cliente(req.body);

        await cliente.insert();

        res.status(201).json({
            success: true,
            message: "Cliente creado correctamente",
            data: cliente
        });
    } catch (error) { //Error handling
        return parse_error(res, error); 
    }
}

ClienteController.update = async (req, res) => {
    try {
        if (Object.keys(req.body).length === 0 && req.body.constructor === Object) //Si pasamos un objeto vacio
            return res.status(204).json({
                success: false,
                message: "No hay ningun campo para actualizar",
            })

        let cliente = {};
        if (req.params.id == "consumidor_final"){
            cliente = await Cliente.get_consumidor_final();
        }else{
            cliente = await Cliente.get_by_id(req.params.id);
        }
        
        await cliente.update(req.body);
        
        return res.status(201).json({
            success: true,
            message: "Cliente actualizado correctamente",
            data: cliente
        })
    } catch (error) {
        return parse_error(res, error);
    }
}

ClienteController.get_stock = async(req, res) => {
    try {
        let cliente = {};
        if (req.params.id == "consumidor_final"){
            cliente = await Cliente.get_consumidor_final();
        }else{
            cliente = await Cliente.get_by_id(req.params.id);
        }
        
        let stock = await cliente.get_stock();
        return res.json(stock)
    } catch (error) {
        return parse_error(res, error);
    }
}

ClienteController.get_ventas = async(req, res) => {
    try {
        let cliente = {};
        if (req.params.id == "consumidor_final"){
            cliente = await Cliente.get_consumidor_final();
        }else{
            cliente = await Cliente.get_by_id(req.params.id);
        }
        
        let ventas = await cliente.get_ventas();
        return res.json(ventas)
    } catch (error) {
        return parse_error(res, error);
    }
}


ClienteController.delet = async (req, res) => {
    try {
        await Cliente.delete(req.params.id)

        return res.json({
            success: true,
            message: `Cliente con id ${req.params.id} eliminado correctamente`
        })

    } catch (error) {
        return parse_error(res, error); 
    }
}

ClienteController.get_all = async function(req, res){
    try {
        let clientes = await Cliente.get_all()
        return res.json(clientes)
    } catch (error) {
        return parse_error(res, error);
    }
}

ClienteController.get_one = async function(req, res){
    try {
        let cliente = {};
        if (req.params.id == "consumidor_final"){
            cliente = await Cliente.get_consumidor_final();
        }else{
            cliente = await Cliente.get_by_id(req.params.id);
        }

        return res.json(cliente);
    } catch (error) {
        return parse_error(res, error); 
    }
}


