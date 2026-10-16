import express, { Express } from "express";
import cors from 'cors';
import { Container } from "./container";
import { auth } from "./lib/auth/auth";
import { handleErrors } from "./lib/http/errors";
import { env } from "./env";

// Factory en vez de un `app`/`server` ya armados a nivel de módulo: quien
// levanta el proceso (`index.ts`) decide cuándo construirla y cuándo
// escuchar — así se puede importar sin efecto secundario (ej. en tests).
// El `container` entra por parámetro (no se importa el singleton de acá)
// para poder armar la app con un container distinto (ej. uno de test).
export function createApp(container: Container): Express {
    const app = express();

    // Restringido a los orígenes conocidos del front (ver env.CORS_ORIGIN);
    // `cors()` sin opciones habilita cualquier origen, lo cual no hace falta
    // acá — esta API nunca se llama desde un origen que no controlemos.
    app.use(cors({ origin: env.CORS_ORIGIN.split(",").map((o) => o.trim()) }));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Sirve los archivos estáticos (facturas/remitos/logos) directo bajo
    // `/files`, sin un router aparte: es la única ruta de la app que no
    // pasa por un módulo de dominio.
    app.use('/files', express.static(env.FILES_PATH));
    app.use('/files/{*splat}', (_, res) => res.status(404).json({
        success: false,
        error: "File does not exists"
    }));

    app.use('/persona', auth, container.persona.router);
    app.use('/coleccion', auth, container.coleccion.router);
    app.use('/deposito', auth, container.deposito.router);
    app.use('/movimiento', auth, container.movimiento.router);
    app.use('/libro', auth, container.libro.router);
    app.use('/cliente', auth, container.cliente.router);
    app.use('/liquidacion', auth, container.liquidacion.router);
    app.use('/liquidaciones', auth, container.liquidaciones.router);

    app.use('/anticipos', auth, container.anticipo.router);

    app.use('/medio_pago', auth, container.medioPago.router);

    app.use('/rol', auth, container.rol.router);

    // `GET /venta/medios_pago` vive dentro del router de transacciones (se
    // registra antes de `/venta/:id`, ver transaccion.routes.ts).
    app.use('/', container.transaccion.router);

    app.use('/user', container.user.router);

    app.use(handleErrors);

    // Cualquier otra ruta no especificada
    app.use('/{*splat}', (_, res) => res.status(404).json({
        success: false,
        error: "Esta ruta no hace nada"
    }));

    return app;
}
