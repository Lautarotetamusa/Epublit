import express from "express";
import multer from "multer";
import { auth } from "../../lib/auth/auth";
import { UserController } from "./user.controller";

export function createUserRoutes(controller: UserController) {
    const router = express.Router();
    const upload = multer();

    router.post('/register', controller.create);

    router.post('/login', controller.login);

    router.post('/verify-email', controller.verifyEmail);

    router.post('/resend-verification', controller.resendVerification);

    router.post('/forgot-password', controller.forgotPassword);

    router.get('/reset-password/:token', controller.getResetPasswordStatus);

    router.post('/reset-password', controller.resetPassword);

    router.put('', auth, controller.update);

    router.post('/uploadCert', auth, upload.single("cert"), controller.uploadCert);

    router.get('/csr', auth, controller.downloadCSR);

    router.get('/facturacion', auth, controller.getFacturacion);

    router.put('/afip', auth, controller.updateAfipData);

    router.get('/', auth, controller.getOne);

    return router;
}
