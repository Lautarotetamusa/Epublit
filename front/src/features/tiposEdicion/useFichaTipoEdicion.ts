import { useCallback, useEffect, useState } from "react";
import { deleteTipoEdicion, listTiposEdicion, updateTipoEdicion } from "../../api/tipoEdicion";
import type { TipoEdicion, UpdateTipoEdicionInput } from "../../api/tipoEdicion";

// No hay `GET /tipo_edicion/:id` en el contrato (mismo criterio que roles): la
// ficha se resuelve buscando el tipo entre los activos de la cuenta, que es un
// set chico. Un tipo ya dado de baja no se puede abrir.
export function useFichaTipoEdicion(id: number) {
    const [tipo, setTipo] = useState<TipoEdicion | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchTipo = useCallback(async () => {
        setLoading(true);
        setTipo((await listTiposEdicion()).find((candidato) => candidato.id === id) ?? null);
        setLoading(false);
    }, [id]);

    useEffect(() => {
        fetchTipo();
    }, [fetchTipo]);

    const update = async (input: UpdateTipoEdicionInput) => {
        await updateTipoEdicion(id, input);
        await fetchTipo();
    };

    const remove = async () => {
        await deleteTipoEdicion(id);
    };

    return { tipo, loading, update, remove };
}
