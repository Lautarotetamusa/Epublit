import { useEffect, useState } from "react";
import { listClientes, getStockCliente } from "../../api/cliente";
import type { Cliente } from "../../api/cliente";
import { createDevolucion } from "../../api/operaciones";
import { useSeleccionLibros } from "../operaciones/useSeleccionLibros";
import type { LibroDisponible } from "../operaciones/useSeleccionLibros";

// No existe un filtro server-side "clientes con stock consignado" (a
// diferencia de la app vieja, que pedía `cliente?stock=1`): se listan todos
// los inscriptos y, si uno no tiene nada consignado, el picker de libros
// simplemente queda vacío (mismo resultado visible, un pedido más).
export function useDevolucionForm(onCreated: () => void) {
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
