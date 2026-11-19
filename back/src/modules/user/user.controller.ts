import { RequestHandler, Response } from "express";
import jwt, {Secret} from "jsonwebtoken";
import { ValidationError } from "../../lib/http/errors";
import {
    userValidator,
    loginUserValidator,
    registroValidator,
    emailValidator,
    tokenValidator,
    restablecerContrasenaValidator,
    User
} from "./user.validator";
import { UserService } from "./user.service";
import { AccesoService } from "./user.acceso.service";
import { parsearAcceso } from "./user.errors";
import { created, ok, success, updated } from "../../lib/http/responses";
import { StringValue } from "ms";

// El controller sólo adapta HTTP: parsea/valida con zod, le pasa los datos
// al service y arma la respuesta. Las reglas de negocio (unicidad de
// username/cuit, alta de AFIP + compensación, verificación de password,
// etc.) viven en user.service.ts.
export type UserControllerDeps = {
    service: UserService;
    accesoService: AccesoService;
};

// El JWT es un artefacto de la capa HTTP (el token que viaja en la
// response), no un dato que el service tenga que conocer: por eso se firma
// acá, después de que el service sólo confirma la credencial.
const firmarSesion = (user: Pick<User, "id" | "cuit">): string => {
    const opts: jwt.SignOptions = {
        expiresIn: process.env.JWT_EXPIRES_IN as StringValue
    };
    return jwt.sign({ id: user.id, cuit: user.cuit }, process.env.JWT_SECRET as Secret, opts);
};

// Mismo cuerpo que el login (token top-level, fuera de `data`): confirmar el
// email y restablecer la contraseña también inician sesión.
const responderSesion = (res: Response, user: Pick<User, "id" | "cuit">, extra: Record<string, string> = {}) =>
    res.status(200).json({
        success: true,
        message: "login exitoso",
        token: firmarSesion(user),
        ...extra
    });

export function createUserController({ service, accesoService }: UserControllerDeps) {
    const create: RequestHandler = async (req, res) => {
        const body = parsearAcceso(registroValidator, req.body);

        created(res, await accesoService.register(body), "Te mandamos un link para confirmar el email");
    }

    const update: RequestHandler = async (req, res) => {
        const body = userValidator.update.parse(req.body);
        const { user, changed } = await service.update(res.locals.user.id, body);

        updated(res, user, changed ? "Usuario actualizado correctamente" : "El usuario esta igual que antes");
    }

    const updateAfipData: RequestHandler = async (req, res) => {
        const user = await service.refreshAfipData(res.locals.user.id);

        updated(res, user, "Usuario actualizado correctamente");
    };

    const login: RequestHandler = async (req, res) => {
        const body = loginUserValidator.parse(req.body);

        responderSesion(res, await accesoService.authenticate(body.identifier, body.password));
    }

    const verifyEmail: RequestHandler = async (req, res) => {
        const { token } = parsearAcceso(tokenValidator, req.body);
        const resultado = await accesoService.verifyEmail(token);

        if (resultado.status === "already_verified") {
            res.status(200).json({ success: true, status: resultado.status });
            return;
        }
        responderSesion(res, resultado.user, { status: resultado.status });
    }

    // Siempre la misma respuesta, haya mail o no: no revela qué emails tienen
    // cuenta.
    const resendVerification: RequestHandler = async (req, res) => {
        const { email } = parsearAcceso(emailValidator, req.body);
        await accesoService.resendVerification(email);

        success(res, 202, {});
    }

    const forgotPassword: RequestHandler = async (req, res) => {
        const { email } = parsearAcceso(emailValidator, req.body);
        await accesoService.forgotPassword(email);

        success(res, 202, {});
    }

    const getResetPasswordStatus: RequestHandler = async (req, res) => {
        const estado = await accesoService.getResetPasswordStatus(String(req.params.token ?? ""));

        res.status(200).json({ success: true, ...estado });
    }

    const resetPassword: RequestHandler = async (req, res) => {
        const { token, password } = parsearAcceso(restablecerContrasenaValidator, req.body);

        responderSesion(res, await accesoService.resetPassword(token, password), { status: "password_reset" });
    }

    const uploadCert: RequestHandler = async (req, res) => {
        if (!req.file) throw new ValidationError("El campo 'cert' es necesario")

        await service.uploadCert(res.locals.user.id, res.locals.user.cuit, req.file.buffer);

        created(res, undefined, "Certificado subido correctamente");
    }

    const getFacturacion: RequestHandler = async (req, res) => {
        ok(res, await service.getEstadoFacturacion(res.locals.user.id));
    }

    const downloadCSR: RequestHandler = async (req, res) => {
        const csr = await service.getCSR(res.locals.user.id);

        res.setHeader("Content-Type", "application/pkcs10");
        res.setHeader("Content-Disposition", `attachment; filename="${csr.filename}"`);
        res.status(200).send(csr.data);
    }

    const getOne: RequestHandler = async (req, res) => {
        const user = await service.findOne({ id: res.locals.user.id });

        ok(res, user);
    }

    return {
        create,
        login,
        verifyEmail,
        resendVerification,
        forgotPassword,
        getResetPasswordStatus,
        resetPassword,
        update,
        getOne,
        uploadCert,
        downloadCSR,
        getFacturacion,
        updateAfipData
    }
}

export type UserController = ReturnType<typeof createUserController>;
