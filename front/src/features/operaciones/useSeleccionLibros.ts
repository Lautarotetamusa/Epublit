import { useState } from "react";

export type LibroDisponible = {
    isbn: string;
    titulo: string;
    precio: number;
    stock: number;
};

export type ItemSeleccionado = LibroDisponible & { cantidad: number };

// Compartido por venta/consignación/devolución (ver useVentaForm.ts,
// ConsignacionesPage.tsx, DevolucionesPage.tsx): elegir libros de una lista
// disponible, validando que la cantidad acumulada no supere el stock.
export function useSeleccionLibros(librosDisponibles: LibroDisponible[]) {
    const [seleccionados, setSeleccionados] = useState<ItemSeleccionado[]>([]);

    const agregar = (isbn: string, cantidad: number): string | null => {
        const libro = librosDisponibles.find((l) => l.isbn === isbn);
        if (!libro) return "El libro seleccionado no está disponible";

        const existente = seleccionados.find((s) => s.isbn === isbn);
        const cantidadPrevia = existente?.cantidad ?? 0;
        if (cantidadPrevia + cantidad > libro.stock) return "La cantidad supera el stock disponible";

        if (existente) {
            setSeleccionados((current) => current.map((s) => (s.isbn === isbn ? { ...s, cantidad: s.cantidad + cantidad } : s)));
        } else {
            setSeleccionados((current) => [...current, { ...libro, cantidad }]);
        }
        return null;
    };

    // Editar la cantidad directo en la fila (en vez de sólo poder quitarla y
    // volver a agregarla): misma validación de stock que `agregar`.
    const actualizar = (isbn: string, cantidad: number): string | null => {
        const libro = librosDisponibles.find((l) => l.isbn === isbn);
        if (!libro) return "El libro seleccionado no está disponible";
        if (cantidad < 1) return "La cantidad tiene que ser al menos 1";
        if (cantidad > libro.stock) return "La cantidad supera el stock disponible";

        setSeleccionados((current) => current.map((s) => (s.isbn === isbn ? { ...s, cantidad } : s)));
        return null;
    };

    const quitar = (isbn: string) => {
        setSeleccionados((current) => current.filter((s) => s.isbn !== isbn));
    };

    const reset = () => setSeleccionados([]);

    const total = seleccionados.reduce((acc, item) => acc + item.cantidad * item.precio, 0);

    return { seleccionados, agregar, actualizar, quitar, reset, total };
}
