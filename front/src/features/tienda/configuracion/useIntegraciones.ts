import { useCallback, useEffect, useState } from "react";
import {
    createIntegracion,
    listIntegraciones,
    revocarIntegracion,
    updateIntegracion
} from "../../../api/tienda";
import type { CreateIntegracionInput, Integracion } from "../../../api/tienda";
import { getErrorMessage } from "../../../lib/errors";

export function useIntegraciones() {
    const [integraciones, setIntegraciones] = useState<Integracion[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchIntegraciones = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await listIntegraciones();
            setIntegraciones(response.data.integraciones);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchIntegraciones();
    }, [fetchIntegraciones]);

    const crear = async (input: CreateIntegracionInput) => {
        const response = await createIntegracion(input);
        // Se agrega con la respuesta del alta: la clave completa no puede
        // perderse si un refetch posterior falla justo después.
        setIntegraciones((actual) => [response.data.integracion, ...actual]);
        return response.data;
    };

    const alternarActiva = async (integracion: Integracion) => {
        const response = await updateIntegracion(integracion.id, { activa: !integracion.activa });
        setIntegraciones((actual) => actual.map((item) => (item.id === integracion.id ? response.data : item)));
    };

    // Revocar no borra la fila: la integración queda visible como revocada
    // para que el admin sepa que esa clave ya no sirve.
    const revocar = async (id: number) => {
        const response = await revocarIntegracion(id);
        setIntegraciones((actual) => actual.map((item) => (item.id === id ? response.data : item)));
    };

    return { integraciones, loading, error, refetch: fetchIntegraciones, crear, alternarActiva, revocar };
}
