import express from "express";
import {createServer} from 'http';

import cors from 'cors';
import "express-async-errors";

import { handleErrors } from "./models/errors";
import { router } from "./routes";
import {join} from "path"; //Crear path para los archivos estaticos

export const app = express();
const server = createServer(app);

const backPort: number = Number(process.env.BACK_PORT) || 3000; // Puerto interno del docker donde se levanta el server
const publicPort: number = Number(process.env.BACK_PUBLIC_PORT) || 80; //Puerto que tiene acceso al mundo
const host = process.env.HOST ? process.env.HOST : "localhost";

export const filesUrl  = `http://${host}:${backPort}/files` as const;
export const filesPath = join(__dirname, "../files");

app.use((req, res, next) => {
    const message = `[server]: ${req.method} ${req.url}`;
    console.log(message);
    next();
});

//Necesesario para que no tire error de CORS
app.use(cors());

app.use(express.json());
app.use(express.urlencoded({extended: true,}));

//Servir los archivos estáticos, lo imoprtamos aca para que filesPath funcione
import { fileRouter } from "./routes/files.routes";
app.use('/files', fileRouter);

app.use(router);

//Cualquier otra ruta no especificada
app.use('*', (req, res) => res.status(404).json({
    success: false,
    error: "Esta ruta no hace nada"
}));

app.use(handleErrors);

server.listen(backPort, () => {
    console.log(`[server]: Server is running at http://${host}:${backPort}`);
});
