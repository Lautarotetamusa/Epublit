import { Venta } from "../models/venta.model.js";
import { Libro } from "../models/libro.model.js";
import { parse_error } from "../models/errors.js"
import { facturar } from "../afip/Afip.js";

export const VentaController = {};

VentaController.vender = async(req, res) => {
    let body = req.body;
    
    try {
        Venta.validate(body);
    
        const venta = new Venta(body);
    
        await venta.set_client(body.cliente);
       
        await venta.set_libros(body.libros);    
    
        console.log("venta:", venta);
        
        for (let i in venta.libros){
            await venta.libros[i].update_stock(-body.libros[i].cantidad);
        }
        
        await venta.insert();
    
        await facturar(venta);
    
        res.status(201).json({
            success: true,
            message: "Venta cargada correctamente",
            ...venta
        });

    } catch (error) {
        return parse_error(res, error);
    }
}

VentaController.get_factura = async(req, res) => {
    const venta = await Venta.get_by_id(req.params.id);

    console.log(venta.file_path);

    res.download('facturas/'+venta.file_path);
}

VentaController.get_one = async(req, res) => {
    try {
        let venta = await Venta.get_by_id(req.params.id);
        //console.log(venta);
        return res.json(venta);
    } catch (error) {
        return parse_error(res, error);
    }
}

VentaController.get_all = async(req, res) => {
    try {
        let ventas = await Venta.get_all(req.params.id);
        //console.log(ventas);
        return res.json(ventas);
    } catch (error) {
        return parse_error(res, error);
    }
}