import { ValidationError } from "../../../lib/http/errors";
import { CredentialsCipher } from "../../../lib/crypto/credentials";
import { MicorreoClient } from "./clients/micorreo.client";
import { PaqarClient } from "./clients/paqar.client";
import { ShippingConfigRepository, ShippingConfigRow } from "./shippingConfig.repository";
import { ShippingConfigUpdate } from "./shippingConfig.validator";

export type ShippingConfigServiceDeps = {
    repository: ShippingConfigRepository;
    cipher: CredentialsCipher;
    micorreoClient: MicorreoClient;
    paqarClient: PaqarClient;
};

export type PublicShippingConfig = {
    micorreo: { usuario: string | null; customerId: string | null; configurado: boolean };
    paqar: { agreement: string | null; sellerId: string | null; configurado: boolean };
    origen: {
        calle: string | null;
        numero: string | null;
        piso: string | null;
        depto: string | null;
        localidad: string | null;
        provincia: string | null;
        codigoPostal: string | null;
    };
    cajaDefault: { altoCm: number; anchoCm: number; largoCm: number };
    pesoPromedioKg: number | null;
    formatoEtiqueta: string;
    retiro: { activo: boolean; direccion: string | null; horario: string | null };
};

export type ShippingOperation = {
    micorreo: { usuario: string; password: string; customerId: string } | null;
    paqar: { agreement: string; apiKey: string; sellerId: string } | null;
    origen: {
        calle: string | null;
        numero: string | null;
        piso: string | null;
        depto: string | null;
        localidad: string | null;
        provincia: string | null;
        codigoPostal: string | null;
    };
    cajaDefault: { altoCm: number; anchoCm: number; largoCm: number };
    pesoPromedioKg: number | null;
    formatoEtiqueta: string;
    retiro: { activo: boolean; direccion: string | null; horario: string | null };
};

const isMicorreoConfigured = (row: ShippingConfigRow | null): boolean =>
    Boolean(row?.micorreo_usuario && row.micorreo_credencial_cifrada && row.micorreo_customer_id);

const isPaqarConfigured = (row: ShippingConfigRow | null): boolean =>
    Boolean(row?.paqar_agreement && row.paqar_api_key_cifrada && row.paqar_seller_id);

const toPublic = (row: ShippingConfigRow | null): PublicShippingConfig => ({
    micorreo: {
        usuario: row?.micorreo_usuario ?? null,
        customerId: row?.micorreo_customer_id ?? null,
        configurado: isMicorreoConfigured(row)
    },
    paqar: {
        agreement: row?.paqar_agreement ?? null,
        sellerId: row?.paqar_seller_id ?? null,
        configurado: isPaqarConfigured(row)
    },
    origen: {
        calle: row?.origen_calle ?? null,
        numero: row?.origen_numero ?? null,
        piso: row?.origen_piso ?? null,
        depto: row?.origen_depto ?? null,
        localidad: row?.origen_localidad ?? null,
        provincia: row?.origen_provincia ?? null,
        codigoPostal: row?.origen_codigo_postal ?? null
    },
    cajaDefault: {
        altoCm: row?.caja_alto_cm ?? 10,
        anchoCm: row?.caja_ancho_cm ?? 10,
        largoCm: row?.caja_largo_cm ?? 10
    },
    pesoPromedioKg: row?.peso_promedio_kg ?? null,
    formatoEtiqueta: row?.formato_etiqueta ?? "10x15",
    retiro: {
        activo: row?.retiro_activo ?? false,
        direccion: row?.retiro_direccion ?? null,
        horario: row?.retiro_horario ?? null
    }
});

export function createShippingConfigService({
    repository,
    cipher,
    micorreoClient,
    paqarClient
}: ShippingConfigServiceDeps) {
    const getConfig = async (userId: number): Promise<PublicShippingConfig> =>
        toPublic(await repository.findByUser(userId));

    const getOperation = async (userId: number): Promise<ShippingOperation> => {
        const row = await repository.findByUser(userId);

        let micorreo = null;
        if (row && isMicorreoConfigured(row)) {
            micorreo = {
                usuario: row.micorreo_usuario!,
                password: cipher.decrypt(row.micorreo_credencial_cifrada!),
                customerId: row.micorreo_customer_id!
            };
        }

        let paqar = null;
        if (row && isPaqarConfigured(row)) {
            paqar = {
                agreement: row.paqar_agreement!,
                apiKey: cipher.decrypt(row.paqar_api_key_cifrada!),
                sellerId: row.paqar_seller_id!
            };
        }

        const publica = toPublic(row);
        return {
            micorreo,
            paqar,
            origen: publica.origen,
            cajaDefault: publica.cajaDefault,
            pesoPromedioKg: publica.pesoPromedioKg,
            formatoEtiqueta: publica.formatoEtiqueta,
            retiro: publica.retiro
        };
    };

    const save = async (userId: number, body: ShippingConfigUpdate): Promise<PublicShippingConfig> => {
        const actual = await repository.findByUser(userId);

        const password = body.micorreo?.password;
        const apiKey = body.paqar?.apiKey;

        const retiroActivo = body.retiro?.activo ?? actual?.retiro_activo ?? false;
        const retiroDireccion =
            body.retiro?.direccion !== undefined
                ? body.retiro.direccion
                : actual?.retiro_direccion ?? null;
        const retiroHorario =
            body.retiro?.horario !== undefined ? body.retiro.horario : actual?.retiro_horario ?? null;

        if (retiroActivo && (!retiroDireccion || !retiroHorario)) {
            throw new ValidationError("Si el retiro está activo, la dirección y el horario son obligatorios");
        }

        const row = await repository.upsert({
            user: userId,
            micorreo_usuario: body.micorreo?.usuario ?? actual?.micorreo_usuario ?? null,
            micorreo_credencial_cifrada:
                password !== undefined
                    ? cipher.encrypt(password)
                    : actual?.micorreo_credencial_cifrada ?? null,
            micorreo_customer_id:
                body.micorreo?.customerId ?? actual?.micorreo_customer_id ?? null,
            paqar_agreement: body.paqar?.agreement ?? actual?.paqar_agreement ?? null,
            paqar_api_key_cifrada:
                apiKey !== undefined ? cipher.encrypt(apiKey) : actual?.paqar_api_key_cifrada ?? null,
            paqar_seller_id: body.paqar?.sellerId ?? actual?.paqar_seller_id ?? null,
            peso_promedio_kg:
                body.pesoPromedioKg !== undefined
                    ? body.pesoPromedioKg
                    : actual?.peso_promedio_kg ?? null,
            origen_calle: body.origen?.calle ?? actual?.origen_calle ?? null,
            origen_numero: body.origen?.numero ?? actual?.origen_numero ?? null,
            origen_piso:
                body.origen?.piso !== undefined ? body.origen.piso : actual?.origen_piso ?? null,
            origen_depto:
                body.origen?.depto !== undefined ? body.origen.depto : actual?.origen_depto ?? null,
            origen_localidad: body.origen?.localidad ?? actual?.origen_localidad ?? null,
            origen_provincia: body.origen?.provincia ?? actual?.origen_provincia ?? null,
            origen_codigo_postal:
                body.origen?.codigoPostal ?? actual?.origen_codigo_postal ?? null,
            caja_alto_cm: body.cajaDefault?.altoCm ?? actual?.caja_alto_cm ?? 10,
            caja_ancho_cm: body.cajaDefault?.anchoCm ?? actual?.caja_ancho_cm ?? 10,
            caja_largo_cm: body.cajaDefault?.largoCm ?? actual?.caja_largo_cm ?? 10,
            formato_etiqueta: body.formatoEtiqueta ?? actual?.formato_etiqueta ?? "10x15",
            retiro_activo: retiroActivo,
            retiro_direccion: retiroDireccion,
            retiro_horario: retiroHorario
        });

        return toPublic(row);
    };

    const testConnection = async (
        userId: number,
        api: "micorreo" | "paqar"
    ): Promise<{ api: string; ok: boolean; mensaje: string }> => {
        const config = await getOperation(userId);

        if (api === "micorreo") {
            if (!config.micorreo) {
                return { api, ok: false, mensaje: "MiCorreo no está configurado" };
            }

            try {
                await micorreoClient.getToken({
                    usuario: config.micorreo.usuario,
                    password: config.micorreo.password
                });
                return { api, ok: true, mensaje: "Conexión con MiCorreo correcta" };
            } catch {
                return { api, ok: false, mensaje: "No se pudo validar la conexión con MiCorreo" };
            }
        }

        if (!config.paqar) {
            return { api, ok: false, mensaje: "PAQ.AR no está configurado" };
        }

        try {
            await paqarClient.auth({ agreement: config.paqar.agreement, apiKey: config.paqar.apiKey });
            return { api, ok: true, mensaje: "Conexión con PAQ.AR correcta" };
        } catch {
            return { api, ok: false, mensaje: "No se pudo validar la conexión con PAQ.AR" };
        }
    };

    return { getConfig, getOperation, save, testConnection };
}

export type ShippingConfigService = ReturnType<typeof createShippingConfigService>;
