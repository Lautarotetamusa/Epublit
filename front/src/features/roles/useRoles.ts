import { useCallback, useEffect, useState } from "react";
import { listRoles } from "../../api/rol";
import type { Rol } from "../../api/rol";

// Los roles activos de la cuenta: es un set chico y sin paginar, que es lo que
// consumen los selectores de rol de las pantallas de libros y personas (mismo
// criterio que `useMediosPago`).
export function useRoles() {
    const [roles, setRoles] = useState<Rol[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchRoles = useCallback(async () => {
        setLoading(true);
        setRoles(await listRoles());
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchRoles();
    }, [fetchRoles]);

    return { roles, loading, refetch: fetchRoles };
}
