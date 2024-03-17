import express from "express"
import { filesPath } from "../app";

export const fileRouter = express.Router();

fileRouter.use(`/`,
    express.static(`${filesPath}/`)
);

fileRouter.use('/*', (req, res) => res.status(404).json({
    success: false,
    error: "File doesnt exists"
}));
