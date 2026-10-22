import { RequestHandler } from "express";
import { newPagination } from "bradb";
import { coleccionValidator } from "./coleccion.validator";
import { ColeccionService } from "./coleccion.service";
import { created, ok, updated, noContent, list } from "../../lib/http/responses";
import { ValidationError } from "../../lib/http/errors";

// El controller sólo adapta HTTP: parsea/valida con zod, le pasa los datos al
// service y elige qué helper de respuesta usar. Las reglas de negocio (ej. no
// borrar una colección con libros) viven en coleccion.service.ts.
export type ColeccionControllerDeps = {
    service: ColeccionService;
};

export function createColeccionController({ service }: ColeccionControllerDeps) {
    const create: RequestHandler = async (req, res) => {
        const body = coleccionValidator.insert.parse(req.body);
        const coleccion = await service.create(body, res.locals.user.id);

        created(res, coleccion, "Colección creada correctamente");
    };

    const getAll: RequestHandler = async (req, res) => {
        const colecciones = await service.findAll(res.locals.user.id);

        ok(res, colecciones);
    };

    const getOne: RequestHandler = async (req, res) => {
        const { id } = coleccionValidator.pk.parse(req.params);
        const coleccion = await service.findOne(id, res.locals.user.id);

        ok(res, coleccion);
    };

    const update: RequestHandler = async (req, res) => {
        const { id } = coleccionValidator.pk.parse(req.params);
        const body = coleccionValidator.update.parse(req.body);
        const coleccion = await service.update(id, res.locals.user.id, body);

        updated(res, coleccion, "Colección actualizada correctamente");
    };

    const remove: RequestHandler = async (req, res) => {
        const { id } = coleccionValidator.pk.parse(req.params);
        await service.remove(id, res.locals.user.id);

        noContent(res);
    };

    const getLibros: RequestHandler = async (req, res) => {
        const { id } = coleccionValidator.pk.parse(req.params);
        const pagination = newPagination(req.query);
        const libros = await service.getLibros(id, res.locals.user.id, pagination);

        list(res, libros, pagination);
    };

    // Multipart de un único archivo (ver coleccion.routes.ts, `upload.single`):
    // las reglas de tipo/tamaño viven en el service, acá sólo se valida que
    // haya llegado algún archivo.
    const uploadPortada: RequestHandler = async (req, res) => {
        if (!req.file) throw new ValidationError("El campo 'portada' es necesario");

        const { id } = coleccionValidator.pk.parse(req.params);
        const coleccion = await service.uploadPortada(id, res.locals.user.id, req.file);

        ok(res, coleccion, "Portada de la colección actualizada correctamente");
    };

    const removePortada: RequestHandler = async (req, res) => {
        const { id } = coleccionValidator.pk.parse(req.params);
        const coleccion = await service.removePortada(id, res.locals.user.id);

        ok(res, coleccion, "Portada de la colección eliminada correctamente");
    };

    return {
        create,
        getAll,
        getOne,
        update,
        remove,
        getLibros,
        uploadPortada,
        removePortada
    };
}

export type ColeccionController = ReturnType<typeof createColeccionController>;
