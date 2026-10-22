import { RequestHandler } from "express";
import { ok } from "../../lib/http/responses";
import { anticipoValidator } from "./anticipo.validator";
import { AnticipoService } from "./anticipo.service";

// El controller sólo adapta HTTP: parsea/valida con zod, llama al service y
// elige el helper de respuesta. Las reglas (pago único, ya pagado → 409)
// viven en anticipo.service.ts.
export type AnticipoControllerDeps = {
    service: AnticipoService;
};

export function createAnticipoController({ service }: AnticipoControllerDeps) {
    // Contrato: array pelado (sin sobre `{success,data}`), igual que
    // `GET /medio_pago/` y `GET /liquidaciones/`.
    const getAll: RequestHandler = async (_, res) => {
        const anticipos = await service.listar(res.locals.user.id);

        res.json(anticipos);
    };

    const pagar: RequestHandler = async (req, res) => {
        const { id } = anticipoValidator.pk.parse(req.params);
        const body = anticipoValidator.pagar.parse(req.body ?? {});

        const anticipo = await service.pagar(id, res.locals.user.id, body);

        ok(res, anticipo, "Anticipo marcado como pagado");
    };

    return {
        getAll,
        pagar
    };
}

export type AnticipoController = ReturnType<typeof createAnticipoController>;
