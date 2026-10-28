import { RequestHandler } from "express";
import type { OrderAdminService } from "./orderAdmin.service";
import {
    labelOrderSchema,
    listOrdersQuery,
    orderCodeSchema,
    rejectOrderSchema
} from "./orderAdmin.validator";

export type OrderAdminControllerDeps = {
    service: OrderAdminService;
};

const sendPdf = (
    res: Parameters<RequestHandler>[1],
    file: { data: Buffer; filename: string }
) => {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${file.filename}"`);
    return res.status(200).send(file.data);
};

export function createOrderAdminController({ service }: OrderAdminControllerDeps) {
    const list: RequestHandler = async (req, res) => {
        const query = listOrdersQuery.parse(req.query);
        res.status(200).json(await service.list(res.locals.user.id, query));
    };

    const detail: RequestHandler = async (req, res) => {
        const codigo = orderCodeSchema.parse(req.params.codigo);
        res.status(200).json(await service.detail(res.locals.user.id, codigo));
    };

    const labelPdf: RequestHandler = async (req, res) => {
        const codigo = orderCodeSchema.parse(req.params.codigo);
        sendPdf(res, await service.getLabel(res.locals.user.id, codigo));
    };

    const accept: RequestHandler = async (req, res) => {
        const codigo = orderCodeSchema.parse(req.params.codigo);
        res.status(200).json(await service.accept(res.locals.user.id, codigo));
    };

    const retryInvoice: RequestHandler = async (req, res) => {
        const codigo = orderCodeSchema.parse(req.params.codigo);
        res.status(200).json(await service.retryInvoice(res.locals.user.id, codigo));
    };

    const reject: RequestHandler = async (req, res) => {
        const codigo = orderCodeSchema.parse(req.params.codigo);
        const body = rejectOrderSchema.parse(req.body ?? {});
        res.status(200).json(await service.reject(res.locals.user.id, codigo, body));
    };

    const generateLabel: RequestHandler = async (req, res) => {
        const codigo = orderCodeSchema.parse(req.params.codigo);
        const body = labelOrderSchema.parse(req.body ?? {});
        res.status(200).json(
            await service.generateLabel(res.locals.user.id, codigo, body.direccion)
        );
    };

    const ship: RequestHandler = async (req, res) => {
        const codigo = orderCodeSchema.parse(req.params.codigo);
        res.status(200).json(await service.ship(res.locals.user.id, codigo));
    };

    const deliver: RequestHandler = async (req, res) => {
        const codigo = orderCodeSchema.parse(req.params.codigo);
        res.status(200).json(await service.deliver(res.locals.user.id, codigo));
    };

    const shipping: RequestHandler = async (req, res) => {
        const codigo = orderCodeSchema.parse(req.params.codigo);
        res.status(200).json(await service.getShipping(res.locals.user.id, codigo));
    };

    const refreshTracking: RequestHandler = async (req, res) => {
        const codigo = orderCodeSchema.parse(req.params.codigo);
        res.status(200).json(await service.refreshTracking(res.locals.user.id, codigo));
    };

    return {
        list,
        detail,
        labelPdf,
        accept,
        retryInvoice,
        reject,
        generateLabel,
        ship,
        deliver,
        shipping,
        refreshTracking
    };
}

export type OrderAdminController = ReturnType<typeof createOrderAdminController>;
