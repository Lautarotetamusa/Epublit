import { RequestHandler } from "express";
import { libroPersonaValidator } from "./libroPersona.validator";
import { LibroPersonaService } from "./libroPersona.service";
import { success } from "../../lib/http/responses";

export type LibroPersonaControllerDeps = {
    service: LibroPersonaService;
};

export function createLibroPersonaController({ service }: LibroPersonaControllerDeps) {
    const addLibroPersonas: RequestHandler = async (req, res) => {
        const body = libroPersonaValidator.bodyBatch.parse(req.body);
        const items = Array.isArray(body) ? body : [body];

        const { libro, personas } = await service.addToLibro(String(req.params.isbn), res.locals.user.id, items);

        success(res, 201, { ...libro, personas }, "Personas agregadas con exito");
    };

    const updateLibroPersonas: RequestHandler = async (req, res) => {
        const body = libroPersonaValidator.bodyBatch.parse(req.body);
        const items = Array.isArray(body) ? body : [body];

        const { libro, personas } = await service.updateInLibro(String(req.params.isbn), res.locals.user.id, items);

        success(res, 201, { ...libro, personas }, "Personas actualizadas con exito");
    };

    const deleteLibroPersonas: RequestHandler = async (req, res) => {
        const body = libroPersonaValidator.removeBatch.parse(req.body);
        const items = Array.isArray(body) ? body : [body];

        const { libro, personas } = await service.removeFromLibro(String(req.params.isbn), res.locals.user.id, items);

        success(res, 200, { ...libro, personas }, "Personas eliminadas con exito");
    };

    return {
        addLibroPersonas,
        updateLibroPersonas,
        deleteLibroPersonas
    };
}

export type LibroPersonaController = ReturnType<typeof createLibroPersonaController>;
