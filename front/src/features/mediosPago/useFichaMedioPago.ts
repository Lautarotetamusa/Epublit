import { useCallback, useEffect, useState } from "react";
import { listMediosPago, updateMedioPago } from "../../api/medioPago";
import type { UpdateMedioPagoInput } from "../../api/medioPago";
import type { MedioPago } from "../../api/operaciones";

// No hay `GET /medio_pago/:id`: la ficha se resuelve buscando el medio entre
// los activos de la cuenta (es un set chico). Un medio ya dado de baja no se
// puede abrir, justamente porque no aparece en el listado.
export function useFichaMedioPago(id: number) {
    const [medio, setMedio] = useState<MedioPago | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchMedio = useCallback(async () => {
        setLoading(true);
        const medios = await listMediosPago();
        setMedio(medios.find((m) => m.id === id) ?? null);
        setLoading(false);
    }, [id]);

    useEffect(() => {
        fetchMedio();
    }, [fetchMedio]);

    const update = async (input: UpdateMedioPagoInput) => {
        await updateMedioPago(id, input);
        await fetchMedio();
    };

    return { medio, loading, update };
}
