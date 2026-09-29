import { useCallback, useEffect, useState } from "react";
import { listLibros } from "../../api/libro";
import type { LibroBase } from "../../api/libro";

// El catálogo completo que necesitan las pantallas de stock y depósitos: con él
// se resuelven los títulos de lo que hay en cada depósito y se trata el `stock`
// que informa `/libro` como línea base del depósito principal (ver
// depositosMock.ts). Mismo criterio que useVentaForm: acá hace falta el catálogo
// entero, no una página.
export function useCatalogoParaStock() {
    const [catalogo, setCatalogo] = useState<LibroBase[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchCatalogo = useCallback(async () => {
        setLoading(true);
        const response = await listLibros({ pageSize: 1000 });
        setCatalogo(response.items.map((libro) => ({ isbn: libro.isbn, titulo: libro.titulo, stock: libro.stock })));
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchCatalogo();
    }, [fetchCatalogo]);

    return { catalogo, loading };
}
