import { RequestHandler } from "express";
import { created, deleted, updated } from "../../lib/http/responses";
import { medioPagoValidator } from "./medioPago.validator";
import { MedioPagoService } from "./medioPago.service";

// El controller sólo adapta HTTP: parsea/valida con zod, llama al service y
// elige el helper de respuesta. Las reglas de negocio (nombre repetido entre
// activos, baja lógica) viven en medioPago.service.ts.
export type MedioPagoControllerDeps = {
    service: MedioPagoService;
};

export function createMedioPagoController({ service }: MedioPagoControllerDeps) {
    // Contrato: array pelado (sin sobre `{success,data}`), igual que
    // `GET /venta/medios_pago` que consumen los formularios de venta.
    const getAll: RequestHandler = async (_, res) => {
        const medios = await service.findActivos(res.locals.user.id);

        res.json(medios);
    };

    const create: RequestHandler = async (req, res) => {
        const body = medioPagoValidator.insert.parse(req.body);
        const medio = await service.create(body, res.locals.user.id);

        created(res, medio, "Medio de pago creado correctamente");
    };

    const update: RequestHandler = async (req, res) => {
        const { id } = medioPagoValidator.pk.parse(req.params);
        const body = medioPagoValidator.update.parse(req.body);
        const medio = await service.update(id, res.locals.user.id, body);

        updated(res, medio, "Medio de pago actualizado correctamente");
    };

    const remove: RequestHandler = async (req, res) => {
        const { id } = medioPagoValidator.pk.parse(req.params);
        await service.remove(id, res.locals.user.id);

        deleted(res, "Medio de pago dado de baja correctamente");
    };

    return {
        getAll,
        create,
        update,
        remove
    };
}

export type MedioPagoController = ReturnType<typeof createMedioPagoController>;
