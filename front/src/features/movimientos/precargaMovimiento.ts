import type { TipoMovimiento } from "../../api/deposito";
import { parsePrecargaOperacion } from "../../lib/precargaOperacion";
import { TIPOS_MOVIMIENTO } from "./movimientoFormato";

// Precarga de un movimiento desde otra pantalla. El catálogo manda los libros
// elegidos (`isbns`), la ficha de un libro manda el libro y a qué depósito
// entra, y la ficha de un depósito manda desde dónde sale:
// `?tipo=transferencia&origen=1&destino=2&isbns=978950...`
export type PrecargaMovimiento = {
    tipo?: TipoMovimiento;
    isbns?: string[];
    origenId?: number;
    destinoId?: number;
};

export function parsePrecargaMovimiento(searchParams: URLSearchParams): PrecargaMovimiento {
    const { isbns } = parsePrecargaOperacion(searchParams);
    const tipo = searchParams.get("tipo");
    const origen = searchParams.get("origen");
    const destino = searchParams.get("destino");

    return {
        isbns,
        tipo: TIPOS_MOVIMIENTO.includes(tipo as TipoMovimiento) ? (tipo as TipoMovimiento) : undefined,
        origenId: origen ? Number(origen) : undefined,
        destinoId: destino ? Number(destino) : undefined
    };
}
