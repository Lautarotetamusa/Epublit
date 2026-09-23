import { Request, Response } from "express";
import { Libro } from "../validators/libro.validator";
import { libroPersonaValidator } from "../validators/libro_persona.validator";
import { libroPersonaService } from "../services/libroPersona.service";

function makeResponse<P>(res: Response, libro: Libro, personas: P[], method: "put" | "post" | "delete"): Response {
    let message: string;
    let code: number;
    switch (method){
        case "delete":
            message = "eliminadas";
            code = 200;
            break;
        case "post":
            message = "agregadas";
            code = 201;
            break;
        case "put":
            message = "actualizadas";
            code = 201;
            break;
    }

    return res.status(code).json({
        success: true,
        message: `Personas ${message} con exito`,
        data: {
            ...libro,
            personas: personas,
        }
    });
}

const addLibroPersonas = async (req: Request, res: Response) => {
    const body = libroPersonaValidator.bodyBatch.parse(req.body);
    const items = Array.isArray(body) ? body : [body];

    const { libro, personas } = await libroPersonaService.addToLibro(String(req.params.isbn), res.locals.user.id, items);

    return makeResponse(res, libro, personas, "post");
};

const updateLibroPersonas = async (req: Request, res: Response) => {
    const body = libroPersonaValidator.bodyBatch.parse(req.body);
    const items = Array.isArray(body) ? body : [body];

    const { libro, personas } = await libroPersonaService.updateInLibro(String(req.params.isbn), res.locals.user.id, items);

    return makeResponse(res, libro, personas, "put");
};

const deleteLibroPersonas = async (req: Request, res: Response) => {
    const body = libroPersonaValidator.removeBatch.parse(req.body);
    const items = Array.isArray(body) ? body : [body];

    const { libro, personas } = await libroPersonaService.removeFromLibro(String(req.params.isbn), res.locals.user.id, items);

    return makeResponse(res, libro, personas, "delete");
};

export default {
    addLibroPersonas,
    updateLibroPersonas,
    deleteLibroPersonas
}
