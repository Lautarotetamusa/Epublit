import { RequestHandler } from "express";
import { z } from "zod";
import { ContenidoService } from "./contenido.service";

export type ContenidoPublicControllerDeps = {
    service: ContenidoService;
};

const slugParamValidator = z.object({ slug: z.string() });

export function createContenidoPublicController({ service }: ContenidoPublicControllerDeps) {
    const listPages: RequestHandler = async (_req, res) => {
        const resultado = await service.listPublicPages(res.locals.integracion.userId);
        res.status(200).json(resultado);
    };

    const getPage: RequestHandler = async (req, res) => {
        const { slug } = slugParamValidator.parse(req.params);
        const resultado = await service.getPublicPage(slug, res.locals.integracion.userId);

        res.status(200).json(resultado);
    };

    const getMenu: RequestHandler = async (_req, res) => {
        const resultado = await service.getPublicMenu(res.locals.integracion.userId);
        res.status(200).json(resultado);
    };

    return {
        listPages,
        getPage,
        getMenu
    };
}

export type ContenidoPublicController = ReturnType<typeof createContenidoPublicController>;
