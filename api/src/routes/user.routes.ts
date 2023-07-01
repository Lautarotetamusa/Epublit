import express from "express"

import UserController from "../controllers/user.controller"

const router = express.Router();

router.post('/register', UserController.create);

router.post('/login', UserController.login);

//router.get('/:id', UserController.get_one);

export default router;
