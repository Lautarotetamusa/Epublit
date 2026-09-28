import { useCallback, useEffect, useState } from "react";
import { listClientes, deleteCliente } from "../../api/cliente";
import type { Cliente } from "../../api/cliente";

// El backend no pagina de verdad `GET /cliente` (devuelve todo, ver
// back/src/modules/cliente/cliente.service.ts#findAll): se trae completo y
// se pagina en el cliente con el mismo componente `Pagination`, en vez de
// simular una paginación de servidor que no existe.
export function useClientes() {
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchClientes = useCallback(async () => {
        setLoading(true);
        const response = await listClientes();
        setClientes(response.items);
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchClientes();
    }, [fetchClientes]);

    const remove = async (id: number) => {
        await deleteCliente(id);
        setClientes((current) => current.filter((c) => c.id !== id));
    };

    return { clientes, loading, remove };
}
