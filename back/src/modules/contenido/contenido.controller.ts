import { RequestHandler } from "express";
import { ContenidoError } from "./contenido.errors";
import { ContenidoService } from "./contenido.service";
import {
    idParamValidator,
    paginaBodyValidator,
    paginaListQueryValidator,
    slugDisponibleQueryValidator,
    usoImagenValidator
} from "./contenido.validator";

export type ContenidoControllerDeps = {
    service: ContenidoService;
};

// El controller sólo adapta HTTP: parsea/valida con zod, pasa el usuario de la
// sesión al service y elige el shape de respuesta del contrato.
export function createContenidoController({ service }: ContenidoControllerDeps) {
    const listPages: RequestHandler = async (req, res) => {
        const query = paginaListQueryValidator.parse(req.query);
        const resultado = await service.listPages(res.locals.user.id, query);

        res.status(200).json(resultado);
    };

    const slugDisponible: RequestHandler = async (req, res) => {
        const query = slugDisponibleQueryValidator.parse(req.query);
        const resultado = await service.slugDisponible(
            res.locals.user.id,
            query.slug,
            query.paginaId
        );

        res.status(200).json(resultado);
    };

    const createPage: RequestHandler = async (req, res) => {
        const body = paginaBodyValidator.parse(req.body);
        const pagina = await service.createPage(res.locals.user.id, body);

        res.status(201).json({ pagina });
    };

    const getPage: RequestHandler = async (req, res) => {
        const { id } = idParamValidator.parse(req.params);
        const pagina = await service.getPage(id, res.locals.user.id);

        res.status(200).json({ pagina });
    };

    const updatePage: RequestHandler = async (req, res) => {
        const { id } = idParamValidator.parse(req.params);
        const body = paginaBodyValidator.parse(req.body);
        const pagina = await service.updatePage(id, res.locals.user.id, body);

        res.status(200).json({ pagina });
    };

    const deletePage: RequestHandler = async (req, res) => {
        const { id } = idParamValidator.parse(req.params);
        const resultado = await service.deletePage(id, res.locals.user.id);

        res.status(200).json(resultado);
    };

    const publicar: RequestHandler = async (req, res) => {
        const { id } = idParamValidator.parse(req.params);
        const pagina = await service.publicar(id, res.locals.user.id);

        res.status(200).json({ pagina });
    };

    const despublicar: RequestHandler = async (req, res) => {
        const { id } = idParamValidator.parse(req.params);
        const pagina = await service.despublicar(id, res.locals.user.id);

        res.status(200).json({ pagina });
    };

    const uploadImage: RequestHandler = async (req, res) => {
        const uso = usoImagenValidator.parse(req.body.uso);
        if (!req.file) {
            throw new ContenidoError(400, "archivo_invalido", "Falta el archivo de la imagen");
        }

        const imagen = await service.uploadImage(res.locals.user.id, uso, req.file);

        res.status(201).json({ imagen });
    };

    const deleteImage: RequestHandler = async (req, res) => {
        const { id } = idParamValidator.parse(req.params);
        const resultado = await service.deleteImage(id, res.locals.user.id);

        res.status(200).json(resultado);
    };

    return {
        listPages,
        slugDisponible,
        createPage,
        getPage,
        updatePage,
        deletePage,
        publicar,
        despublicar,
        uploadImage,
        deleteImage
    };
}

export type ContenidoController = ReturnType<typeof createContenidoController>;
