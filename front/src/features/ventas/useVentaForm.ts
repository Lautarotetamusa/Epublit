import { useEffect, useMemo, useRef, useState } from "react";
import { listClientes } from "../../api/cliente";
import type { Cliente } from "../../api/cliente";
import { listLibros } from "../../api/libro";
import type { Libro } from "../../api/libro";
import { getStockCliente } from "../../api/cliente";
import type { StockCliente } from "../../api/cliente";
import { getMediosPago, createVenta, createVentaConsignacion } from "../../api/operaciones";
import type { MedioPago, TipoCbte, VentaDetalle } from "../../api/operaciones";
import { useSeleccionLibros } from "../operaciones/useSeleccionLibros";
import type { LibroDisponible } from "../operaciones/useSeleccionLibros";

export type TipoVenta = "firme" | "consignacion";

// Precarga de la venta desde otra pantalla: seleccionar libros en el
// catálogo y venir con "Nueva venta", o venir de la ficha/listado de un
// cliente con "Venta en firme" ya avanza el formulario.
export type VentaFormInitial = {
    clienteId?: number;
    tipoVenta?: TipoVenta;
    isbns?: string[];
};

// Toda la lógica/estado de "Nueva venta" (firme o sobre consignación,
// mismo formulario — igual criterio que la app vieja): la pantalla sólo
// renderiza lo que este hook expone.
export function useVentaForm(onCreated: (venta: VentaDetalle) => void, initial?: VentaFormInitial) {
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [libros, setLibros] = useState<Libro[]>([]);
    const [mediosPago, setMediosPago] = useState<MedioPago[]>([]);

    useEffect(() => {
        listClientes().then((r) => setClientes(r.items));
        // pageSize alto: acá hace falta el catálogo completo para el
        // selector, no una página — a diferencia de CatalogoPage, que sí
        // pagina de verdad.
        listLibros({ pageSize: 1000 }).then((r) => setLibros(r.items));
        getMediosPago().then(setMediosPago);
    }, []);

    const [tipoVenta, setTipoVenta] = useState<TipoVenta | "">("");
    const [clienteId, setClienteId] = useState<number | "">("");
    const [descuento, setDescuento] = useState("0");
    const [medioPago, setMedioPago] = useState<MedioPago | "">("");
    const [tipoCbte] = useState<TipoCbte>(11);
    const [fechaVenta, setFechaVenta] = useState("");
    const [stockConsignado, setStockConsignado] = useState<StockCliente[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const librosDisponibles: LibroDisponible[] = useMemo(() => {
        if (tipoVenta === "consignacion") {
            return stockConsignado.map((s) => ({ isbn: s.isbn, titulo: s.titulo, precio: s.precio, stock: s.stock }));
        }
        return libros.map((l) => ({ isbn: l.isbn, titulo: l.titulo, precio: l.precio, stock: l.stock ?? 0 }));
    }, [tipoVenta, stockConsignado, libros]);

    const { seleccionados, agregar, actualizar, quitar, reset: resetSeleccion, total } = useSeleccionLibros(librosDisponibles);

    const resetForm = () => {
        setTipoVenta("");
        setClienteId("");
        setDescuento("0");
        setMedioPago("");
        setFechaVenta("");
        setStockConsignado([]);
        resetSeleccion();
    };

    const handleTipoVentaChange = (value: TipoVenta | "") => {
        setTipoVenta(value);
        setClienteId("");
        resetSeleccion();
        setStockConsignado([]);
    };

    const handleClienteChange = async (id: number | "") => {
        setClienteId(id);
        resetSeleccion();
        if (tipoVenta === "consignacion" && id !== "") {
            const response = await getStockCliente(id);
            setStockConsignado(response.data);
        } else {
            setStockConsignado([]);
        }
    };

    // Aplica la precarga que llega por navegación una sola vez, en etapas:
    // primero el tipo de venta (dispara el reset de cliente/selección propio
    // de `handleTipoVentaChange`), después el cliente (cuando `tipoVenta` ya
    // cambió, para que `handleClienteChange` vea el valor correcto) y por
    // último los libros del catálogo (cuando ya está en "firme" y el
    // catálogo terminó de cargar, para que `agregar` los encuentre).
    const appliedTipo = useRef(false);
    useEffect(() => {
        if (appliedTipo.current) return;
        if (!initial?.tipoVenta && !initial?.clienteId && !initial?.isbns?.length) return;
        appliedTipo.current = true;
        handleTipoVentaChange(initial.tipoVenta ?? "firme");
        // Sólo debe correr una vez al montar (el ref ya lo garantiza);
        // `initial`/`handleTipoVentaChange` cambian de referencia en cada
        // render y no hace falta reaccionar a eso acá.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const appliedCliente = useRef(false);
    useEffect(() => {
        if (appliedCliente.current) return;
        if (tipoVenta === "") return;
        appliedCliente.current = true;
        if (initial?.clienteId) handleClienteChange(initial.clienteId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tipoVenta]);

    const appliedIsbns = useRef(false);
    useEffect(() => {
        if (appliedIsbns.current) return;
        if (!initial?.isbns?.length) return;
        if (tipoVenta !== "firme" || libros.length === 0) return;
        appliedIsbns.current = true;
        initial.isbns.forEach((isbn) => agregar(isbn, 1));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tipoVenta, libros]);

    const submit = async (): Promise<string | null> => {
        if (clienteId === "" || medioPago === "" || seleccionados.length === 0) {
            return "Completá cliente, medio de pago y al menos un libro";
        }
        if (tipoVenta === "consignacion" && !fechaVenta) {
            return "Completá la fecha de venta";
        }

        const libros = seleccionados.map((s) => ({ isbn: s.isbn, cantidad: s.cantidad }));
        setSubmitting(true);
        try {
            const response =
                tipoVenta === "firme"
                    ? await createVenta({
                          cliente: clienteId,
                          libros,
                          descuento: Number(descuento) || 0,
                          medio_pago: medioPago,
                          tipo_cbte: tipoCbte
                      })
                    : await createVentaConsignacion({
                          cliente: clienteId,
                          libros,
                          descuento: Number(descuento) || 0,
                          medio_pago: medioPago,
                          tipo_cbte: tipoCbte,
                          fecha_venta: fechaVenta
                      });
            resetForm();
            onCreated(response.data);
            return null;
        } finally {
            setSubmitting(false);
        }
    };

    return {
        clientes,
        mediosPago,
        tipoVenta,
        clienteId,
        descuento,
        medioPago,
        fechaVenta,
        librosDisponibles,
        seleccionados,
        total,
        submitting,
        setTipoVenta: handleTipoVentaChange,
        setClienteId: handleClienteChange,
        setDescuento,
        setMedioPago,
        setFechaVenta,
        agregarLibro: agregar,
        actualizarCantidadLibro: actualizar,
        quitarLibro: quitar,
        submit
    };
}
