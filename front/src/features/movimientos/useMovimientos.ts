import { useCallback, useEffect, useState } from "react";
import type { Movimiento } from "../../api/deposito";
import { mockListarMovimientos } from "../depositos/depositosMock";

// Historial de movimientos del usuario, del más reciente al más antiguo (lo
// ordena el mock, igual que el listado real). El mock es una estructura en
// memoria, así que después de registrar un movimiento hay que releer.
export function useMovimientos() {
    const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
    const [loading, setLoading] = useState(true);

    const refetch = useCallback(() => {
        setMovimientos(mockListarMovimientos());
        setLoading(false);
    }, []);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { movimientos, loading, refetch };
}
