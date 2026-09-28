import { RequestHandler } from "express";
import { newPagination } from "bradb";
import fs from "fs";
import { libroValidator } from "./libro.validator";
import { LibroService } from "./libro.service";
import { created, ok, updated, deleted, list } from "../../lib/http/responses";
import { ValidationError } from "../../lib/http/errors";

// El controller sólo adapta HTTP: parsea/valida con zod, le pasa los datos
// al service y elige qué helper de respuesta usar. Las reglas de negocio
// (ej. no duplicar isbn) viven en libro.service.ts.
export type LibroControllerDeps = {
    service: LibroService;
};

export function createLibroController({ service }: LibroControllerDeps) {
    const create: RequestHandler = async (req, res) => {
        const userId = res.locals.user.id;
        const libroBody = libroValidator.insert.parse(req.body);

        const libro = await service.create(libroBody, userId);

        created(res, libro, `Libro con isbn ${libroBody.isbn} creado correctamente`);
    };

    const update: RequestHandler = async (req, res) => {
        const isbn = String(req.params.isbn);
        const userId = res.locals.user.id;
        const body = libroValidator.update.parse(req.body);

        const libro = await service.update(isbn, userId, body);

        updated(res, libro, `Libro con isbn ${isbn} actualizado correctamente`);
    };

    const remove: RequestHandler = async (req, res) => {
        const isbn = String(req.params.isbn);
        await service.remove(isbn, res.locals.user.id);

        deleted(res, `Libro con isbn ${isbn} eliminado correctamente`);
    };

    const getPrecios: RequestHandler = async (req, res) => {
        const precios = await service.getPrecios(String(req.params.isbn), res.locals.user.id);
        ok(res, precios);
    };

    const getOne: RequestHandler = async (req, res) => {
        const isbn = String(req.params.isbn);
        const userId = res.locals.user.id;

        const libro = await service.findOneWithPersonas(isbn, userId);

        ok(res, libro);
    };

    // Exporta a CSV todo el catálogo del usuario (sin paginar, `findAllOrdered`):
    // sigue siendo un detalle de formato HTTP (armar el archivo y mandarlo por
    // `res.download`), no una regla de negocio, así que se queda acá.
    const listaLibros: RequestHandler = async (req, res) => {
        const libros = await service.findAllOrdered({ user: res.locals.user.id });

        const len = Object.keys(libros[0]).length;
        const header = "LISTA DE LIBROS" + ",".repeat(len) + "\r\n";
        const headers = Object.keys(libros[0]).join(",") + "\r\n";
        const data = libros.map((l) => Object.values(l).join(",")).join("\r\n");

        const filePath = "lista_libros.csv";
        fs.writeFileSync(filePath, header + headers + data);
        res.download(filePath);
    };

    // Multipart de un único archivo (ver libro.routes.ts, `upload.single`):
    // las reglas de tipo/tamaño viven en el service, acá sólo se valida que
    // haya llegado algún archivo.
    const uploadPortada: RequestHandler = async (req, res) => {
        if (!req.file) throw new ValidationError("El campo 'portada' es necesario");

        const isbn = String(req.params.isbn);
        const userId = res.locals.user.id;

        const libro = await service.uploadPortada(isbn, userId, req.file);

        ok(res, libro, `Portada del libro con isbn ${isbn} actualizada correctamente`);
    };

    const getAll: RequestHandler = async (req, res) => {
        const userId = res.locals.user.id;
        const pagination = newPagination(req.query);
        const filters = libroValidator.filter.parse({ ...req.query, user: userId });

        const libros = await service.findAllPaginated(filters, pagination);

        list(res, libros, pagination);
    };

    return {
        getAll,
        getOne,
        getPrecios,
        create,
        remove,
        update,
        uploadPortada,
        listaLibros
    };
}

export type LibroController = ReturnType<typeof createLibroController>;
