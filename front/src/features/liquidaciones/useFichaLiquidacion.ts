import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../api/client";
import { anularPago, getLiquidacion, registrarPago } from "../../api/liquidaciones";
import type { Liquidacion, RegistrarPagoInput } from "../../api/liquidaciones";

// La ficha trabaja sobre la liquidación que devuelve cada escritura (registrar o
// anular un pago) en vez de re-consultar: el backend ya recalcula los totales y
// el estado de cada persona con los pagos vigentes.
export function useFichaLiquidacion(id: number) {
    const [liquidacion, setLiquidacion] = useState<Liquidacion | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchLiquidacion = useCallback(async () => {
        if (!Number.isFinite(id)) {
            setLiquidacion(null);
            return;
        }

        try {
            setLiquidacion(await getLiquidacion(id));
        } catch (err) {
            // Una liquidación inexistente (o de otra cuenta) es un 404: la ficha
            // muestra el estado vacío en vez de romper.
            if (err instanceof ApiError && err.status === 404) {
                setLiquidacion(null);
            } else {
                throw err;
            }
        }
    }, [id]);

    useEffect(() => {
        setLoading(true);
        fetchLiquidacion().finally(() => setLoading(false));
    }, [fetchLiquidacion]);

    const pagar = async (idPersona: number, input: RegistrarPagoInput) => {
        setLiquidacion(await registrarPago(id, idPersona, input));
    };

    const anular = async (idPago: number) => {
        setLiquidacion(await anularPago(id, idPago));
    };

    return { liquidacion, loading, pagar, anular };
}
