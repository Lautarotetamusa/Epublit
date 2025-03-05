import express from "express";
import multer from "multer";

import UserController from "../controllers/user.controller";

import {auth} from "../middleware/auth";

const router = express.Router();

const upload = multer();

router.post('/register', UserController.create);

router.post('/login', UserController.login);

router.post('/uploadCert', auth, upload.single("cert"), UserController.uploadCert);

router.put('/afip', auth, UserController.updateAfipData);

router.get('/', auth, UserController.getOne);

export default router;
