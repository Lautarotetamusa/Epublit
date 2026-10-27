import { useCallback, useEffect, useState } from "react";
import {
    getShippingConfig,
    testShippingConnection,
    updateShippingConfig
} from "../../../api/tienda";
import type { ShippingConfig, ShippingConfigUpdate } from "../../../api/tienda";
import { getErrorMessage } from "../../../lib/errors";
import { normalizarProvincia } from "../../../lib/provincias";

export type EnviosForm = {
    usuario: string;
    password: string;
    customerId: string;
    agreement: string;
    apiKey: string;
    sellerId: string;
    pesoPromedio: string;
    calle: string;
    numero: string;
    piso: string;
    localidad: string;
    provincia: string;
    codigoPostal: string;
    altoCm: string;
    anchoCm: string;
    largoCm: string;
    retiroActivo: boolean;
    direccionRetiro: string;
    horarioRetiro: string;
};

export function enviosFormDesdeConfig(config: ShippingConfig | null): EnviosForm {
    return {
        usuario: config?.micorreo.usuario ?? "",
        password: "",
        customerId: config?.micorreo.customerId ?? "",
        agreement: config?.paqar.agreement ?? "",
        apiKey: "",
        sellerId: config?.paqar.sellerId ?? "",
        pesoPromedio: config?.pesoPromedioKg !== null && config?.pesoPromedioKg !== undefined ? String(config.pesoPromedioKg) : "",
        calle: config?.origen.calle ?? "",
        numero: config?.origen.numero ?? "",
        piso: config?.origen.piso ?? "",
        localidad: config?.origen.localidad ?? "",
        provincia: normalizarProvincia(config?.origen.provincia ?? null),
        codigoPostal: config?.origen.codigoPostal ?? "",
        altoCm: String(config?.cajaDefault.altoCm ?? 10),
        anchoCm: String(config?.cajaDefault.anchoCm ?? 10),
        largoCm: String(config?.cajaDefault.largoCm ?? 10),
        retiroActivo: config?.retiro.activo ?? false,
        direccionRetiro: config?.retiro.direccion ?? "",
        horarioRetiro: config?.retiro.horario ?? ""
    };
}

// El body anidado que espera el backend. Los secretos vacíos se omiten para
// conservar el valor cifrado que ya está guardado.
function aInput(form: EnviosForm): ShippingConfigUpdate {
    const input: ShippingConfigUpdate = {
        formatoEtiqueta: "10x15",
        pesoPromedioKg: Number(form.pesoPromedio),
        cajaDefault: {
            altoCm: Number(form.altoCm),
            anchoCm: Number(form.anchoCm),
            largoCm: Number(form.largoCm)
        },
        retiro: {
            activo: form.retiroActivo,
            direccion: form.retiroActivo ? form.direccionRetiro.trim() || null : null,
            horario: form.retiroActivo ? form.horarioRetiro.trim() || null : null
        }
    };

    if (form.usuario.trim() || form.password || form.customerId.trim()) {
        input.micorreo = {
            usuario: form.usuario.trim() || undefined,
            password: form.password || undefined,
            customerId: form.customerId.trim() || undefined
        };
    }

    if (form.agreement.trim() || form.apiKey || form.sellerId.trim()) {
        input.paqar = {
            agreement: form.agreement.trim() || undefined,
            apiKey: form.apiKey || undefined,
            sellerId: form.sellerId.trim() || undefined
        };
    }

    const origenCompleto =
        form.calle.trim() &&
        form.numero.trim() &&
        form.localidad.trim() &&
        form.provincia.trim() &&
        form.codigoPostal.trim();

    if (origenCompleto) {
        input.origen = {
            calle: form.calle.trim(),
            numero: form.numero.trim(),
            piso: form.piso.trim() || null,
            localidad: form.localidad.trim(),
            provincia: form.provincia.trim(),
            codigoPostal: form.codigoPostal.trim()
        };
    }

    return input;
}

export function useEnviosConfig() {
    const [config, setConfig] = useState<ShippingConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchConfig = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await getShippingConfig();
            setConfig(response.data);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    const guardar = async (form: EnviosForm) => {
        const response = await updateShippingConfig(aInput(form));
        setConfig(response.data);
        return response.data;
    };

    const probar = (apiName: "micorreo" | "paqar") => testShippingConnection(apiName);

    return { config, loading, error, refetch: fetchConfig, guardar, probar };
}
