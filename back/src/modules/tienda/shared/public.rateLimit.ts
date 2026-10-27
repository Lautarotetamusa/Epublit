import rateLimit from "express-rate-limit";
import { sendPublicError } from "./public.errors";

export type PublicRateLimitConfig = {
    ventanaMs: number;
    requestsPorIp: number;
    ventanaPedidosMs: number;
    pedidosPorIp: number;
};

// La API key es pública (vive en el JS de la tienda), así que el límite va por
// IP: sin él, un script puede reservar todo el stock de una editorial creando
// pedidos que nunca se pagan.
export const DEFAULT_PUBLIC_RATE_LIMITS: PublicRateLimitConfig = {
    ventanaMs: 60_000,
    requestsPorIp: 120,
    ventanaPedidosMs: 15 * 60_000,
    pedidosPorIp: 20
};

const limiter = (windowMs: number, limit: number) =>
    rateLimit({
        windowMs,
        limit,
        standardHeaders: "draft-7",
        legacyHeaders: false,
        handler: (_req, res) =>
            sendPublicError(res, 429, "limite_excedido", "Demasiadas solicitudes, probá de nuevo en unos minutos")
    });

export function createPublicRateLimits(config: PublicRateLimitConfig) {
    return {
        requests: limiter(config.ventanaMs, config.requestsPorIp),
        pedidos: limiter(config.ventanaPedidosMs, config.pedidosPorIp)
    };
}
