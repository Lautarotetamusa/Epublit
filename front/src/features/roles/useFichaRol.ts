import { useCallback, useEffect, useState } from "react";
import { deleteRol, listRoles, updateRol } from "../../api/rol";
import type { Rol, UpdateRolInput } from "../../api/rol";

// No hay `GET /rol/:id` en el contrato (ver specs/011-roles/plan.md): la ficha
// se resuelve buscando el rol entre los activos de la cuenta, que es un set
// chico. Un rol ya dado de baja no se puede abrir, justamente porque no aparece
// en el listado (mismo criterio que la ficha de un medio de pago).
export function useFichaRol(id: number) {
    const [rol, setRol] = useState<Rol | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchRol = useCallback(async () => {
        setLoading(true);
        setRol((await listRoles()).find((candidato) => candidato.id === id) ?? null);
        setLoading(false);
    }, [id]);

    useEffect(() => {
        fetchRol();
    }, [fetchRol]);

    const update = async (input: UpdateRolInput) => {
        await updateRol(id, input);
        await fetchRol();
    };

    const remove = async () => {
        await deleteRol(id);
    };

    return { rol, loading, update, remove };
}
