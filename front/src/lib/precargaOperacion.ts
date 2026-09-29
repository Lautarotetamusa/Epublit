// Precarga de una operación en bulk desde otra pantalla (catálogo de libros o
// ficha de cliente): la pantalla que selecciona libros navega con
// `?clienteId=1&isbns=978950...,978987...` y la que recibe la selección arma
// su estado inicial con esto. Compartido por NuevaVentaPage y
// DevolucionesPage para no duplicar el parseo.
export type PrecargaOperacion = {
    clienteId?: number;
    isbns?: string[];
};

export function parsePrecargaOperacion(searchParams: URLSearchParams): PrecargaOperacion {
    const clienteId = searchParams.get("clienteId");
    const isbns = searchParams.get("isbns");
    return {
        clienteId: clienteId ? Number(clienteId) : undefined,
        isbns: isbns ? isbns.split(",").filter(Boolean) : undefined
    };
}
