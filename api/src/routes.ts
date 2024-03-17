import PersonaRouter from "./routes/persona.routes";
import LibroRouter from "./routes/libro.routes";
import ClienteRouter from "./routes/cliente.routes";
import VentaRouter from "./routes/venta.routes";
import ConsignacionRouter from "./routes/consignacion.routes";
import UserRouter from "./routes/user.routes"
import LiquidacionRouter from "./routes/liquidacion.routes"
import { auth } from "./middleware/auth";

import { Router } from "express"

export const router = Router();

router.use('/persona', auth, PersonaRouter);

router.use('/libro', auth, LibroRouter);

router.use('/cliente', auth, ClienteRouter);

router.use('/venta', auth, VentaRouter);

router.use('/consignacion', auth, ConsignacionRouter);

router.use('/liquidacion', auth, LiquidacionRouter);

router.use('/user', UserRouter);
