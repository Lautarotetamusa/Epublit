import { Conflict, ExternalServiceError, ValidationError } from "../../../lib/http/errors";
import { CredentialsCipher } from "../../../lib/crypto/credentials";
import type {
    MercadoPagoClient,
    MercadoPagoConfig,
    MercadoPagoOAuthTokens
} from "./mercadopago.client";
import type { MercadoPagoRepository, MercadoPagoRow } from "./mercadopago.repository";
import { createOAuthState, verifyOAuthState } from "./oauthState";
import { PublicApiError } from "../shared/public.errors";

export type MercadoPagoServiceDeps = {
    repository: MercadoPagoRepository;
    client: MercadoPagoClient;
    cipher: CredentialsCipher;
    config: MercadoPagoConfig;
};

export type MercadoPagoStatus = {
    conectado: boolean;
    alias?: string | null;
    email?: string | null;
    aplicacionId?: string | null;
    conectadoEl?: Date;
};

const isClientError = (status: number | undefined): boolean =>
    status !== undefined && status >= 400 && status < 500;

const expiresAt = (tokens: MercadoPagoOAuthTokens): Date =>
    new Date(Date.now() + tokens.expiresIn * 1000);

export function createMercadoPagoService({
    repository,
    client,
    cipher,
    config
}: MercadoPagoServiceDeps) {
    const saveTokens = async (userId: number, mpUserId: string, tokens: MercadoPagoOAuthTokens) => {
        console.info("[mercadopago] guardando conexión", { userId, mpUserId });
        const user = await client.getUser(tokens.accessToken);
        console.info("[mercadopago] usuario de MercadoPago obtenido", {
            userId,
            mpUserId,
            tieneAlias: Boolean(user.alias)
        });

        if (await repository.isMpUserConnectedToAnotherAccount(mpUserId, userId)) {
            console.warn("[mercadopago] la cuenta de MercadoPago ya está conectada a otro usuario", {
                userId,
                mpUserId
            });
            throw new Conflict("Ese usuario de MercadoPago ya está conectado a otra cuenta");
        }

        await repository.saveConnection({
            user: userId,
            mpUserId,
            alias: user.alias,
            email: user.email,
            aplicacionId: tokens.clientId ?? (config.clientId || null),
            accessTokenCifrado: cipher.encrypt(tokens.accessToken),
            refreshTokenCifrado: tokens.refreshToken ? cipher.encrypt(tokens.refreshToken) : null,
            vencimiento: expiresAt(tokens)
        });

        console.info("[mercadopago] conexión guardada", { userId, mpUserId });
        return user;
    };

    const getStatus = async (userId: number): Promise<MercadoPagoStatus> => {
        const row = await repository.findConnectedByUser(userId);
        console.info("[mercadopago] estado consultado", {
            userId,
            conectado: Boolean(row)
        });
        if (!row) return { conectado: false };

        return {
            conectado: true,
            alias: row.alias,
            email: row.email,
            aplicacionId: row.aplicacion_id,
            conectadoEl: row.conectado_en
        };
    };

    const getConnectUrl = async (userId: number): Promise<{ url: string }> => {
        if (await repository.findConnectedByUser(userId)) {
            throw new Conflict("La cuenta ya tiene MercadoPago conectado");
        }
        if (!config.clientId || !config.redirectUri) {
            throw new Conflict("MercadoPago no está configurado en este entorno");
        }

        console.info("[mercadopago] generando URL de autorización", {
            userId,
            clientId: config.clientId,
            redirectUri: config.redirectUri
        });
        const state = createOAuthState(userId, config.webhookSecret || config.clientSecret);
        const url = new URL(`${config.authBaseUrl}/authorization`);
        url.searchParams.set("client_id", config.clientId);
        url.searchParams.set("response_type", "code");
        url.searchParams.set("platform_id", "mp");
        url.searchParams.set("state", state);
        url.searchParams.set("redirect_uri", config.redirectUri);
        url.searchParams.set("scope", "offline_access");

        return { url: url.toString() };
    };

    const callback = async (code: string, state: string): Promise<string> => {
        const payload = verifyOAuthState(state, config.webhookSecret || config.clientSecret);
        if (!payload) {
            console.warn("[mercadopago] callback con state inválido o vencido");
            throw new ValidationError("Estado de OAuth inválido o vencido");
        }

        console.info("[mercadopago] callback recibido", { userId: payload.userId });

        try {
            const tokens = await client.exchangeCode(code);
            console.info("[mercadopago] code canjeado", {
                userId: payload.userId,
                mpUserId: tokens.userId,
                clientId: tokens.clientId,
                scope: tokens.scope,
                tieneRefreshToken: Boolean(tokens.refreshToken)
            });

            const mpUserId = tokens.userId ?? (await client.getUser(tokens.accessToken)).id;
            await saveTokens(payload.userId, mpUserId, tokens);

            const redirect = new URL(`${config.panelUrl.replace(/\/$/, "")}/tienda`);
            redirect.searchParams.set("mercadopago", "conectado");
            console.info("[mercadopago] callback completado", {
                userId: payload.userId,
                mpUserId
            });
            return redirect.toString();
        } catch (error) {
            console.error("[mercadopago] error procesando callback", {
                userId: payload.userId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    };

    const disconnect = async (userId: number): Promise<{ conectado: false }> => {
        await repository.deleteByUser(userId);
        return { conectado: false };
    };

    const disconnectRevoked = async (userId: number): Promise<never> => {
        await repository.deleteByUser(userId);
        throw new PublicApiError(409, "mercadopago_no_conectado", "MercadoPago no está conectado");
    };

    const requestRefresh = async (row: MercadoPagoRow, refreshTokenCifrado: string): Promise<string> => {
        const tokens = await client
            .refreshToken(cipher.decrypt(refreshTokenCifrado))
            .catch(async (err: unknown) => {
                // Solo un 4xx de OAuth (`invalid_grant`) significa que la
                // editorial revocó el acceso. Un timeout o un 5xx es transitorio:
                // borrar la conexión ahí dejaría la tienda sin cobrar.
                if (err instanceof ExternalServiceError && isClientError(err.status)) {
                    return disconnectRevoked(row.user);
                }
                throw new PublicApiError(502, "proveedor_no_disponible", "MercadoPago no respondió");
            });

        await repository.updateTokens(row.user, {
            accessTokenCifrado: cipher.encrypt(tokens.accessToken),
            refreshTokenCifrado: tokens.refreshToken ? cipher.encrypt(tokens.refreshToken) : null,
            vencimiento: expiresAt(tokens)
        });

        return tokens.accessToken;
    };

    // MP invalida el refresh token al usarlo: dos refrescos concurrentes del
    // mismo usuario harían fallar al segundo con `invalid_grant` y se borraría
    // una conexión válida. Se comparte la promesa en curso por usuario.
    const refreshesInFlight = new Map<number, Promise<string>>();

    const refreshAccessToken = (row: MercadoPagoRow): Promise<string> => {
        if (!row.refresh_token_cifrado) return disconnectRevoked(row.user);

        const enCurso = refreshesInFlight.get(row.user);
        if (enCurso) return enCurso;

        const refresh = requestRefresh(row, row.refresh_token_cifrado).finally(() =>
            refreshesInFlight.delete(row.user)
        );
        refreshesInFlight.set(row.user, refresh);
        return refresh;
    };

    const accessTokenFor = async (row: MercadoPagoRow | null): Promise<string> => {
        if (!row) {
            throw new PublicApiError(409, "mercadopago_no_conectado", "MercadoPago no está conectado");
        }

        const vence = row.vencimiento?.getTime() ?? 0;
        if (vence <= Date.now() + 60_000) return refreshAccessToken(row);

        return cipher.decrypt(row.access_token_cifrado);
    };

    const getAccessToken = async (userId: number): Promise<string> =>
        accessTokenFor(await repository.findConnectedByUser(userId));

    const getAccessTokenByMpUserId = async (mpUserId: string): Promise<string> =>
        accessTokenFor(await repository.findConnectedByMpUserId(mpUserId));

    return {
        getStatus,
        getConnectUrl,
        callback,
        disconnect,
        getAccessToken,
        getAccessTokenByMpUserId,
        getConnection: repository.findConnectedByUser,
        getConnectionByMpUserId: repository.findConnectedByMpUserId,
        getConfig: () => config
    };
}

export type MercadoPagoService = ReturnType<typeof createMercadoPagoService>;
