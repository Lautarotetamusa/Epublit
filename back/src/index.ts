import { createServer } from 'http';
import { createApp } from "./app";
import { container } from "./container";
import { env } from "./env";
import { startTiendaExpirationJob } from "./modules/tienda/order/expiration.service";
import { startLimpiezaCuentasPendientes } from "./modules/user";

export const app = createApp(container);
export const server = createServer(app);

startTiendaExpirationJob(container.tienda.expirationService);
startLimpiezaCuentasPendientes({ limpiar: container.user.accesoService.limpiarPendientesVencidas });

server.listen(env.PORT, () => {
    console.log(`[server]: Server is running at ${env.HOST}`);
});
