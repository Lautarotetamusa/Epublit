import { RequestHandler } from "express";
import { created, deleted, ok, updated } from "../../lib/http/responses";
import { libroResenaValidator } from "./libroResena.validator";
import { LibroResenaService } from "./libroResena.service";

export type LibroResenaControllerDeps = {
    service: LibroResenaService;
};

export function createLibroResenaController({ service }: LibroResenaControllerDeps) {
    const getAll: RequestHandler = async (req, res) => {
        ok(res, await service.listar(String(req.params.isbn), res.locals.user.id));
    };

    const create: RequestHandler = async (req, res) => {
        const { url } = libroResenaValidator.body.parse(req.body);
        created(res, await service.crear(String(req.params.isbn), res.locals.user.id, url), "Reseña agregada con exito");
    };

    const update: RequestHandler = async (req, res) => {
        const { isbn, id } = libroResenaValidator.pk.parse(req.params);
        const { url } = libroResenaValidator.body.parse(req.body);
        updated(res, await service.editar(isbn, id, res.locals.user.id, url), "Reseña actualizada con exito");
    };

    const remove: RequestHandler = async (req, res) => {
        const { isbn, id } = libroResenaValidator.pk.parse(req.params);
        await service.borrar(isbn, id, res.locals.user.id);
        deleted(res, "Reseña eliminada con exito");
    };

    return { getAll, create, update, remove };
}

export type LibroResenaController = ReturnType<typeof createLibroResenaController>;
