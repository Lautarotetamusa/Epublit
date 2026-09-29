import { useEffect, useRef, useState } from "react";
import { listClientes, getCliente, getStockCliente } from "../../api/cliente";
import type { Cliente } from "../../api/cliente";
import { createDevolucion } from "../../api/operaciones";
import { useSeleccionLibros } from "../operaciones/useSeleccionLibros";
import type { LibroDisponible } from "../operaciones/useSeleccionLibros";

// Precarga de la devolución desde la ficha del cliente: el cliente y los
// libros elegidos en la tabla de consignación llegan por navegación (ver
// FichaClientePage.tsx).
export type DevolucionFormInitial = {
    clienteId?: number;
    isbns?: string[];
};

// No existe un filtro server-side "clientes con stock consignado" (a
// diferencia de la app vieja, que pedía `cliente?stock=1`): se listan todos
// los inscriptos y, si uno no tiene nada consignado, el picker de libros
// simplemente queda vacío (mismo resultado visible, un pedido más).
export function useDevolucionForm(onCreated: () => void, initial?: DevolucionFormInitial) {
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [clienteId, setClienteId] = useState<number | "">("");
    const [librosDisponibles, setLibrosDisponibles] = useState<LibroDisponible[]>([]);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        listClientes({ tipo: "inscripto" }).then((r) => setClientes(r.items));
    }, []);

    const { seleccionados, agregar, actualizar, quitar, reset } = useSeleccionLibros(librosDisponibles);

    const handleClienteChange = async (id: number | "") => {
        setClienteId(id);
        reset();
        if (id === "") {
            setLibrosDisponibles([]);
            return;
        }
        const response = await getStockCliente(id);
        setLibrosDisponibles(response.data.map((s) => ({ isbn: s.isbn, titulo: s.titulo, precio: s.precio, stock: s.stock })));
    };

    // El listado sólo trae inscriptos, pero la devolución puede venir
    // precargada desde la ficha de un cliente que no esté en esa lista: sin
    // esto el Combobox quedaría vacío aunque el cliente ya esté elegido.
    useEffect(() => {
        if (!initial?.clienteId || clientes.length === 0) return;
        if (clientes.some((c) => c.id === initial.clienteId)) return;
        getCliente(initial.clienteId).then((r) => setClientes((current) => [...current, r.data]));
    }, [clientes, initial?.clienteId]);

    // La precarga se aplica una sola vez y en etapas: primero el cliente (que
    // dispara la carga del stock contra el que se valida cada libro) y después
    // los libros, cuando ese stock ya está disponible para `agregar`.
    const appliedCliente = useRef(false);
    useEffect(() => {
        if (appliedCliente.current) return;
        if (!initial?.clienteId) return;
        appliedCliente.current = true;
        handleClienteChange(initial.clienteId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const appliedIsbns = useRef(false);
    useEffect(() => {
        if (appliedIsbns.current) return;
        if (!initial?.isbns?.length) return;
        if (librosDisponibles.length === 0) return;
        appliedIsbns.current = true;
        initial.isbns.forEach((isbn) => agregar(isbn, 1));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [librosDisponibles]);

    const submit = async (): Promise<string | null> => {
        if (clienteId === "" || seleccionados.length === 0) {
            return "Completá el cliente y al menos un libro";
        }

        setSubmitting(true);
        try {
            await createDevolucion({
                cliente: clienteId,
                libros: seleccionados.map((s) => ({ isbn: s.isbn, cantidad: s.cantidad }))
            });
            setClienteId("");
            setLibrosDisponibles([]);
            reset();
            onCreated();
            return null;
        } finally {
            setSubmitting(false);
        }
    };

    return {
        clientes,
        clienteId,
        setClienteId: handleClienteChange,
        librosDisponibles,
        seleccionados,
        agregar,
        actualizar,
        quitar,
        submitting,
        submit
    };
}
