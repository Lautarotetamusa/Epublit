import { RequestHandler, Response } from "express";
import { createSessionAuth } from "../../lib/auth/auth";
import type { UserRepository } from "../user";

// El 401 distingue "no hay sesión / token inválido" del 403 de una sesión
// válida sin permiso. El front usa esa diferencia para no borrar la sesión
// cuando sólo falta el rol (ver specs/028-panel-admin-metricas).
const sinSesion = (res: Response) =>
    res.status(401).json({
        success: false,
        errors: [{ code: "unauthorized", message: "Sesión inválida" }]
    });

const sinPermiso = (res: Response) =>
    res.status(403).json({
        success: false,
        errors: [{ code: "admin_required", message: "Acceso restringido" }]
    });

export function createAdminAuth({
    userRepository
}: {
    userRepository: Pick<UserRepository, "findOne">;
}): RequestHandler[] {
    const autenticado = createSessionAuth({ onMissing: sinSesion, onInvalid: sinSesion });

    // El rol se lee de la base en cada request: dar o quitar el rol impacta en
    // la siguiente consulta, sin esperar a que venza el token.
    const exigirAdmin: RequestHandler = async (_, res, next) => {
        const user = await userRepository.findOne({ id: res.locals.user.id });
        if (!user) return sinSesion(res);
        if (user.role !== "admin") return sinPermiso(res);

        next();
    };

    return [autenticado, exigirAdmin];
}
