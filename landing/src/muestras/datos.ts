// Datos de ejemplo para las pantallas que no tienen captura real (remito,
// factura, pedido de la tienda): un título inventado, siempre mostrado con el
// rótulo "Datos de ejemplo".

export const LIBRO = {
    titulo: "Un patio con higuera",
    isbn: "978-987-0000-12-4",
    precio: 18500
};

export const REMITO = {
    numero: "0001-00000148",
    fecha: "05/11/2026",
    cliente: "Librería Aguafuerte",
    cuit: "30-00000000-7",
    lineas: [
        { isbn: LIBRO.isbn, titulo: LIBRO.titulo, cantidad: 40 },
        { isbn: "978-987-0000-08-7", titulo: "El faro de los gatos", cantidad: 25 },
        { isbn: "978-987-0000-15-5", titulo: "Mapa de nubes", cantidad: 15 }
    ]
};

export const FACTURA = {
    letra: "A",
    codigo: "01",
    numero: "0003-00000391",
    fecha: "12/11/2026",
    cliente: "Librería Aguafuerte",
    cantidad: 4,
    precioUnitario: 18500,
    cae: "76450000000000",
    vencimientoCae: "22/11/2026"
};

export const PEDIDO = {
    codigo: "TW-2048",
    comprador: "Martina Sosa",
    fecha: "14/11/2026",
    libros: [
        { titulo: LIBRO.titulo, cantidad: 1, precio: 18500 },
        { titulo: "Mapa de nubes", cantidad: 1, precio: 16900 }
    ]
};
