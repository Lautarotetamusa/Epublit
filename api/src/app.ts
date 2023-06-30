import express, {NextFunction, Request, Response} from "express"

import * as dotenv from 'dotenv'

import personaRouter from "./routes/persona.routes";
import libroRouter from "./routes/libro.routes";
import ClienteRouter from "./routes/cliente.routes.js";
import VentaRouter from "./routes/venta.routes.js";
import ConsignacionRouter from "./routes/consignacion.routes.js";

dotenv.config();
export const app = express();

if (!process.env.BACK_PORT){
    console.log("Error: la variable BACK_PORT no está seteada");
    process.exit(1);
}
const port: number = Number(process.env.BACK_PORT);

//Necesesario para que no tire error de   CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Authorization, X-API-KEY, Origin, X-Requested-With, Content-Type, Accept, Access-Control-Allow-Request-Method');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.header('Allow', 'GET, POST, OPTIONS, PUT, DELETE');
    next();
});

app.use(express.json());
app.use(express.urlencoded({extended: true,}));

app.use('/persona', personaRouter);

app.use('/libro', libroRouter);

app.use('/cliente', ClienteRouter);

app.use('/venta', VentaRouter);

app.use('/consignacion', ConsignacionRouter);

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
