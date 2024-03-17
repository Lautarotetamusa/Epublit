import express from "express"
import { filesPath } from "../app";

export const fileRouter = express.Router();

fileRouter.use(`/`,
    express.static(`${filesPath}/`)
);
