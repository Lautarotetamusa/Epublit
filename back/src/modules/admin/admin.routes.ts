import express, { RequestHandler } from "express";
import { AdminController } from "./admin.controller";

// @mount router
// @note Requiere sesión con rol `admin`; una cuenta `editorial` recibe `403` (admin_required) y sin sesión `401` (unauthorized).
export function createAdminRoutes(controller: AdminController, auth: RequestHandler[]) {
    const router = express.Router();

    router.use(auth);

    router.get('/resumen', controller.getResumen);
    router.get('/embudo', controller.getEmbudo);
    router.get('/serie', controller.getSerie);
    router.get('/cuentas', controller.getCuentas);

    return router;
}
