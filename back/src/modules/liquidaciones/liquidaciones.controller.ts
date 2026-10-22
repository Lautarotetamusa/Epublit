import { RequestHandler } from "express";
import { created, ok } from "../../lib/http/responses";
import { liquidacionesValidator } from "./liquidaciones.validator";
import { LiquidacionesService } from "./liquidaciones.service";

// El controller sólo adapta HTTP: parsea/valida con zod, llama al service y
// elige el helper de respuesta. Las reglas (no liquidar dos veces, 409 sin
// ventas pendientes, saldo de un pago) viven en liquidaciones.service.ts.
export type LiquidacionesControllerDeps = {
    service: LiquidacionesService;
};

export function createLiquidacionesController({ service }: LiquidacionesControllerDeps) {
    // Contrato: array pelado (sin sobre `{success,data}`), igual que
    // `GET /medio_pago/`.
    const getAll: RequestHandler = async (_, res) => {
        res.json(await service.listar(res.locals.user.id));
    };

    const generar: RequestHandler = async (req, res) => {
        const { desde, hasta } = liquidacionesValidator.rango.parse(req.body);
        const ficha = await service.generar(res.locals.user.id, desde, hasta);

        created(res, ficha, "Liquidación generada correctamente");
    };

    const getFicha: RequestHandler = async (req, res) => {
        const { id } = liquidacionesValidator.pk.parse(req.params);
        ok(res, await service.ficha(res.locals.user.id, id));
    };

    const registrarPago: RequestHandler = async (req, res) => {
        const { id, idPersona } = liquidacionesValidator.pagoParams.parse(req.params);
        const body = liquidacionesValidator.pago.parse(req.body);
        const ficha = await service.registrarPago(res.locals.user.id, id, idPersona, body);

        created(res, ficha, "Pago registrado correctamente");
    };

    const anularPago: RequestHandler = async (req, res) => {
        const { id, idPago } = liquidacionesValidator.anularParams.parse(req.params);
        const ficha = await service.anularPago(res.locals.user.id, id, idPago);

        ok(res, ficha, "Pago anulado correctamente");
    };

    return {
        getAll,
        generar,
        getFicha,
        registrarPago,
        anularPago
    };
}

export type LiquidacionesController = ReturnType<typeof createLiquidacionesController>;
