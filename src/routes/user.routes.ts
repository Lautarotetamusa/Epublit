import express from "express";

import UserController from "../controllers/user.controller";

import {auth} from "../middleware/auth";

const router = express.Router();

router.post('/register', UserController.create);

router.post('/login', UserController.login);

router.put('/afip', auth, UserController.updateAfipData);

router.get('/welcome', auth, UserController.welcome);

export default router;
