import PersonaRouter from "./routes/persona.routes";
import LibroRouter from "./routes/libro.routes";
import ClienteRouter from "./routes/cliente.routes";
import TransaccionRouter from "./routes/transaccion.routes";
import UserRouter from "./routes/user.routes"
import LiquidacionRouter from "./routes/liquidacion.routes"
import { auth } from "./middleware/auth";

import { Router } from "express"
import { medioPago } from "./schemas/venta.schema";

export const router = Router();

router.use('/persona', auth, PersonaRouter);

router.use('/libro', auth, LibroRouter);

router.use('/cliente', auth, ClienteRouter);

router.get('/venta/medios_pago', async (_, res) => {
    return res.json(Object.keys(medioPago));
});
router.use('/', TransaccionRouter);

router.use('/liquidacion', auth, LiquidacionRouter);

router.use('/user', UserRouter);
