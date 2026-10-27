import { randomBytes, createHash } from "crypto";
import { Conflict } from "../../../lib/http/errors";
import { IntegrationRepository, IntegrationRow } from "./integration.repository";
import { IntegrationCreate, IntegrationUpdate } from "./integration.validator";
import { PublicApiError } from "../shared/public.errors";

export type IntegrationServiceDeps = {
    repository: IntegrationRepository;
};

export type PublicIntegration = {
    id: number;
    nombre: string;
    prefijo: string;
    origen: string;
    activa: boolean;
    revocada: boolean;
    ultimoUso: Date | null;
    creadaEn: Date;
};

export type AuthenticatedIntegration = PublicIntegration & { userId: number; keyHash: string };

const API_KEY_PREFIX = "epb_";
const PREFIX_LENGTH = 8;

const hashApiKey = (apiKey: string): string => createHash("sha256").update(apiKey).digest("hex");

// La clave se genera una sola vez y se devuelve completa en el alta; después
// sólo queda el hash (lookup) y el prefijo visible (ver spec).
const generateApiKey = (): string => `${API_KEY_PREFIX}${randomBytes(24).toString("base64url")}`;

const toPublic = (row: IntegrationRow): PublicIntegration => ({
    id: row.id,
    nombre: row.nombre,
    prefijo: row.prefijo,
    origen: row.origen,
    activa: row.activa,
    revocada: row.revocada,
    ultimoUso: row.ultimo_uso,
    creadaEn: row.creada_en
});

const toAuthenticated = (row: IntegrationRow): AuthenticatedIntegration => ({
    ...toPublic(row),
    userId: row.user,
    keyHash: row.clave_hash
});

export function createIntegrationService({ repository }: IntegrationServiceDeps) {
    const create = async (data: IntegrationCreate, userId: number) => {
        const apiKey = generateApiKey();
        const row = await repository.insert({
            ...data,
            user: userId,
            prefijo: apiKey.slice(0, PREFIX_LENGTH),
            keyHash: hashApiKey(apiKey)
        });

        return { integracion: toPublic(row), apiKey };
    };

    const findAll = async (userId: number) => {
        const rows = await repository.findAll(userId);
        return rows.map(toPublic);
    };

    const update = async (id: number, userId: number, data: IntegrationUpdate) => {
        const actual = await repository.findOne(id, userId);

        // Revocar es irreversible: una integración revocada no vuelve a
        // autenticar aunque se intente reactivar (ver spec).
        if (actual.revocada && data.activa) {
            throw new Conflict("Una integración revocada no se puede reactivar");
        }

        const row = await repository.update(id, userId, data);
        return toPublic(row);
    };

    const revoke = async (id: number, userId: number) => {
        const actual = await repository.findOne(id, userId);
        if (actual.revocada) return toPublic(actual);

        const row = await repository.revoke(id, userId);
        return toPublic(row);
    };

    const authenticate = async (apiKey: string | undefined): Promise<AuthenticatedIntegration> => {
        if (!apiKey) {
            throw new PublicApiError(401, "no_autenticado", "Falta la API key de la integración");
        }

        const row = await repository.findByHash(hashApiKey(apiKey));
        if (!row) {
            throw new PublicApiError(401, "no_autenticado", "La API key no es válida");
        }

        if (!row.activa || row.revocada) {
            throw new PublicApiError(403, "integracion_inactiva", "La integración no está activa");
        }

        return toAuthenticated(row);
    };

    // Si el request no trae `Origin` (llamada server-to-server) no hay CORS que
    // validar; si lo trae, debe coincidir exactamente con el origen guardado.
    const isOriginAllowed = (integracion: PublicIntegration, origen: string | undefined): boolean => {
        if (origen === undefined) return true;
        return integracion.origen === origen;
    };

    const assertOrigin = (integracion: PublicIntegration, origen: string | undefined) => {
        if (!isOriginAllowed(integracion, origen)) {
            throw new PublicApiError(403, "origen_no_permitido", "El origen no está permitido para esta integración");
        }
    };

    return {
        create,
        findAll,
        update,
        revoke,
        authenticate,
        assertOrigin,
        originHasActiveIntegration: repository.existsActiveByOrigin,
        registerUsage: repository.touchLastUsed
    };
}

export type IntegrationService = ReturnType<typeof createIntegrationService>;
