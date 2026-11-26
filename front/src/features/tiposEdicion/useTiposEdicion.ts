import { useCallback, useEffect, useState } from "react";
import { listTiposEdicion } from "../../api/tipoEdicion";
import type { TipoEdicion } from "../../api/tipoEdicion";

// Los tipos de edición activos de la cuenta: set chico y sin paginar, que es
// lo que consumen el listado y el selector del formulario de libro (mismo
// criterio que `useRoles`).
export function useTiposEdicion() {
    const [tipos, setTipos] = useState<TipoEdicion[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchTipos = useCallback(async () => {
        setLoading(true);
        setTipos(await listTiposEdicion());
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchTipos();
    }, [fetchTipos]);

    return { tipos, loading, refetch: fetchTipos };
}
