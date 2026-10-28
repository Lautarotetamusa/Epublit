import express, { Express } from "express";
import cors from 'cors';
import { Container } from "./container";
import { auth, authConSesion } from "./lib/auth/auth";
import { handleErrors } from "./lib/http/errors";
import { env } from "./env";

// Factory en vez de un `app`/`server` ya armados a nivel de módulo: quien
// levanta el proceso (`index.ts`) decide cuándo construirla y cuándo
// escuchar — así se puede importar sin efecto secundario (ej. en tests).
// El `container` entra por parámetro (no se importa el singleton de acá)
// para poder armar la app con un container distinto (ej. uno de test).
export function createApp(container: Container): Express {
    const app = express();
    app.set("trust proxy", env.TRUST_PROXY ?? 0);

    // Restringido a los orígenes conocidos del front (ver env.CORS_ORIGIN);
    // `cors()` sin opciones habilita cualquier origen, lo cual no hace falta
    // acá — esta API nunca se llama desde un origen que no controlemos.
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // API pública de la tienda: maneja su propio CORS por integración y no usa
    // la sesión del panel (ver specs/016-tienda-ecommerce).
    app.use('/public/tienda/v1', container.tienda.publicRouter);

    // CORS del panel, restringido a los orígenes conocidos del front (ver
    // env.CORS_ORIGIN); la API pública ya resolvió el suyo arriba.
    app.use(cors({ origin: env.CORS_ORIGIN.split(",").map((o) => o.trim()) }));

    // Sirve los archivos estáticos (portadas, fotos, logos) directo bajo
    // `/files`, sin un router aparte. Los comprobantes ya no se generan como
    // PDF: se bloquean sus carpetas históricas (y las etiquetas, que tienen su
    // propia ruta autenticada) antes del `express.static`.
    app.use(['/files/facturas', '/files/remitos', '/files/etiquetas'], (_, res) => res.status(404).json({
        success: false,
        error: "File does not exists"
    }));
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
    app.use('/metricas', auth, container.metricas.router);

    app.use('/integraciones', auth, container.tienda.router);

    // OAuth de MercadoPago: el callback llega desde el navegador sin sesión y
    // se autentica con el state firmado; por eso va antes del auth del panel.
    app.use('/tienda/mercadopago/callback', container.tienda.oauthCallbackRouter);
    app.use('/tienda', auth, container.tienda.adminRouter);

    // Panel de pedidos: rutas absolutas bajo `/pedidos` (ver
    // specs/016-tienda-ecommerce), separado de la configuración de `/tienda`.
    app.use('/pedidos', auth, container.tienda.orderAdminRouter);

    // Comprobantes fiscales (DTO para render en el panel y reintento AFIP).
    app.use('/comprobantes', authConSesion, container.comprobante.router);

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
