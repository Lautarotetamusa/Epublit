import { useEffect, useState } from "react";
import { getLibroDepositos } from "../../api/libro";
import type { StockEnDeposito } from "../../api/deposito";

// Desglose del stock de un libro entre los depósitos donde tiene cantidad mayor
// a 0 (ver specs/008-movimientos-deposito). El total no se pide acá: ya viene en
// el propio libro (`stock`), que es la suma de este desglose.
export function useDesgloseLibro(isbn: string) {
    const [depositos, setDepositos] = useState<StockEnDeposito[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelado = false;
        setLoading(true);
        getLibroDepositos(isbn).then((response) => {
            if (cancelado) return;
            setDepositos(response.data.depositos);
            setLoading(false);
        });
        return () => {
            cancelado = true;
        };
    }, [isbn]);

    return { depositos, loading };
}
