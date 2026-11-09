import { RequestHandler } from "express";
import { CatalogService } from "./catalog.service";
import { catalogValidator } from "./catalog.validator";

export type CatalogControllerDeps = {
    service: CatalogService;
};

export function createCatalogController({ service }: CatalogControllerDeps) {
    const getConfig: RequestHandler = async (_req, res) => {
        const config = await service.getConfig(res.locals.integracion.userId);
        res.status(200).json(config);
    };

    const getBooks: RequestHandler = async (req, res) => {
        const query = catalogValidator.query.parse(req.query);
        const libros = await service.getBooks(res.locals.integracion.userId, query);

        res.status(200).json(libros);
    };

    const getBook: RequestHandler = async (req, res) => {
        const isbn = catalogValidator.isbn.parse(req.params.isbn);
        const libro = await service.getBook(isbn, res.locals.integracion.userId);

        res.status(200).json(libro);
    };

    const getPersonas: RequestHandler = async (_req, res) => {
        const personas = await service.getPersonas(res.locals.integracion.userId);

        res.status(200).json(personas);
    };

    const getCollections: RequestHandler = async (_req, res) => {
        const colecciones = await service.getCollections(res.locals.integracion.userId);

        res.status(200).json(colecciones);
    };

    return {
        getConfig,
        getBooks,
        getBook,
        getPersonas,
        getCollections
    };
}

export type CatalogController = ReturnType<typeof createCatalogController>;
