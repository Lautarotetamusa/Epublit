import { RequestHandler } from "express";
import { adminValidator } from "./admin.validator";
import { AdminService } from "./admin.service";

// Adapter HTTP puro: parsea/valida la query y responde el objeto tal como lo
// define el contrato del panel. Las reglas de cálculo viven en el service.
export type AdminControllerDeps = {
    service: AdminService;
};

export function createAdminController({ service }: AdminControllerDeps) {
    const getResumen: RequestHandler = async (_, res) => {
        res.json(await service.resumen());
    };

    const getEmbudo: RequestHandler = async (_, res) => {
        res.json(await service.embudo());
    };

    const getSerie: RequestHandler = async (_, res) => {
        res.json(await service.serie());
    };

    const getCuentas: RequestHandler = async (req, res) => {
        const filtros = adminValidator.listado(req.query);
        res.json(await service.cuentas(filtros));
    };

    return { getResumen, getEmbudo, getSerie, getCuentas };
}

export type AdminController = ReturnType<typeof createAdminController>;
