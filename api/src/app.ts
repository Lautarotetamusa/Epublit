import express, {NextFunction, Request, Response} from "express"

import * as dotenv from 'dotenv'
import cors from 'cors';

import PersonaRouter from "./routes/persona.routes";
import LibroRouter from "./routes/libro.routes";
import ClienteRouter from "./routes/cliente.routes.js";
import VentaRouter from "./routes/venta.routes.js";
import ConsignacionRouter from "./routes/consignacion.routes.js";
import UserRouter from "./routes/user.routes.js"
import LiquidacionRouter from "./routes/liquidacion.routes"

import {auth} from "./middleware/auth";

dotenv.config();
export const app = express();

if (!process.env.BACK_PORT){
    console.log("Error: la variable BACK_PORT no está seteada");
    process.exit(1);
}
if (!process.env.JWT_EXPIRES_IN){
    console.log("Error: la variable JWT_EXPIRES_IN no está seteada");
    process.exit(1);
}
if (!process.env.JWT_SECRET){
    console.log("Error: la variable JWT_SECRET no está seteada");
    process.exit(1);
}

const port: number = Number(process.env.BACK_PORT);

//Necesesario para que no tire error de   CORS
app.use(cors());
/*app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Authorization, X-API-KEY, Origin, X-Requested-With, Content-Type, Accept, Access-Control-Allow-Request-Method');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.header('Allow', 'GET, POST, OPTIONS, PUT, DELETE');
    next();
});*/

app.use(express.json());
app.use(express.urlencoded({extended: true,}));

app.use('/persona', auth, PersonaRouter);

app.use('/libro', auth, LibroRouter);

app.use('/cliente', auth, ClienteRouter);

app.use('/venta', auth, VentaRouter);

app.use('/consignacion', auth, ConsignacionRouter);

app.use('/user', UserRouter);

app.use('/liquidacion', LiquidacionRouter);

//Cualquier otra ruta no especificada
app.use('*', (req, res) => res.status(404).json({
    success: false,
    error: "Esta ruta no hace nada negro"
}));

app.listen(port, () => console.log(`Libros Silvestres start in port ${port}!`))

app.use(function(err: Error, req: Request, res: Response, next: NextFunction) {
    console.error("app use:", err.stack);
    res.status(500).json({
        success: false,
        error: err,
        test: "test"
    });
    next();
  });
