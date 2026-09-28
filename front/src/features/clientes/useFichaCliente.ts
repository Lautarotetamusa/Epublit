import { useCallback, useEffect, useState } from "react";
import { getCliente, updateCliente, getStockCliente, syncPreciosCliente } from "../../api/cliente";
import type { Cliente, UpdateClienteInput, StockCliente } from "../../api/cliente";

export function useFichaCliente(id: number) {
    const [cliente, setCliente] = useState<Cliente | null>(null);
    const [stock, setStock] = useState<StockCliente[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    const fetchCliente = useCallback(async () => {
        const response = await getCliente(id);
        setCliente(response.data);
    }, [id]);

    const fetchStock = useCallback(async () => {
        const response = await getStockCliente(id);
        setStock(response.data);
    }, [id]);

    useEffect(() => {
        setLoading(true);
        Promise.all([fetchCliente(), fetchStock()]).then(() => setLoading(false));
    }, [fetchCliente, fetchStock]);

    const update = async (input: UpdateClienteInput) => {
        await updateCliente(id, input);
        await fetchCliente();
    };

    const syncPrecios = async () => {
        setSyncing(true);
        try {
            const response = await syncPreciosCliente(id);
            setStock(response.data);
        } finally {
            setSyncing(false);
        }
    };

    return { cliente, stock, loading, syncing, update, syncPrecios };
}
