import { useEffect, useState } from "react";
import { listClientes } from "../../api/cliente";
import type { Cliente } from "../../api/cliente";
import { listLibros } from "../../api/libro";
import type { Libro } from "../../api/libro";
import { createConsignacion } from "../../api/operaciones";
import { useSeleccionLibros } from "../operaciones/useSeleccionLibros";

export function useConsignacionForm(onCreated: () => void) {
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [libros, setLibros] = useState<Libro[]>([]);
    const [clienteId, setClienteId] = useState<number | "">("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        // Sólo clientes inscriptos pueden recibir consignaciones (regla del
        // backend, ver back/src/modules/transaccion/operacion.config.ts).
        listClientes({ tipo: "inscripto" }).then((r) => setClientes(r.items));
        listLibros({ pageSize: 1000 }).then((r) => setLibros(r.items));
    }, []);

    const librosDisponibles = libros.map((l) => ({ isbn: l.isbn, titulo: l.titulo, precio: l.precio, stock: l.stock ?? 0 }));
    const { seleccionados, agregar, actualizar, quitar, reset } = useSeleccionLibros(librosDisponibles);

    const submit = async (): Promise<string | null> => {
        if (clienteId === "" || seleccionados.length === 0) {
            return "Completá el cliente y al menos un libro";
        }

        setSubmitting(true);
        try {
            await createConsignacion({
                cliente: clienteId,
                libros: seleccionados.map((s) => ({ isbn: s.isbn, cantidad: s.cantidad }))
            });
            setClienteId("");
            reset();
            onCreated();
            return null;
        } finally {
            setSubmitting(false);
        }
    };

    return { clientes, clienteId, setClienteId, librosDisponibles, seleccionados, agregar, actualizar, quitar, submitting, submit };
}
