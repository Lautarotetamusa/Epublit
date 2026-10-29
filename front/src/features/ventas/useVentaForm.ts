import { useEffect, useMemo, useRef, useState } from "react";
import { listClientes } from "../../api/cliente";
import type { Cliente } from "../../api/cliente";
import { listLibros } from "../../api/libro";
import type { Libro } from "../../api/libro";
import { getStockCliente } from "../../api/cliente";
import type { StockCliente } from "../../api/cliente";
import { getMediosPago, createVenta, createVentaConsignacion } from "../../api/operaciones";
import type { MedioPago, TipoCbte, VentaDetalle } from "../../api/operaciones";
import { listDepositos } from "../../api/deposito";
import type { Deposito } from "../../api/deposito";
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
    const [depositos, setDepositos] = useState<Deposito[]>([]);
    const [depositoPrincipal, setDepositoPrincipal] = useState("");
    // El catálogo se pide recién cuando ya se conocen los depósitos: así no
    // se carga primero sin `deposito_id` y otra vez con el principal.
    const [depositosListos, setDepositosListos] = useState(false);
    // Depósito elegido para venta en firme. Default: el principal.
    const [depositoId, setDepositoId] = useState<number | "">("");

    useEffect(() => {
        listClientes().then((r) => setClientes(r.items));
        getMediosPago().then(setMediosPago);
        // Guardamos el array completo de depósitos (no solo el nombre del principal).
        listDepositos().then((r) => {
            setDepositos(r.data);
            const principal = r.data.find((d) => d.principal);
            setDepositoPrincipal(principal?.nombre ?? "");
            // Default: depósito principal.
            setDepositoId(principal?.id ?? "");
            setDepositosListos(true);
        });
    }, []);

    const [tipoVenta, setTipoVenta] = useState<TipoVenta | "">("");
    const [clienteId, setClienteId] = useState<number | "">("");
    const [descuento, setDescuento] = useState("0");
    const [medioPago, setMedioPago] = useState<number | "">("");
    const [tipoCbte] = useState<TipoCbte>(11);
    const [fechaVenta, setFechaVenta] = useState("");
    const [stockConsignado, setStockConsignado] = useState<StockCliente[]>([]);
    const [submitting, setSubmitting] = useState(false);

    // Catálogo de venta en firme: el stock del picker es el del depósito
    // elegido, que el backend expone como `disponible_en_deposito` (ver
    // specs/018). En consignación no se pide porque el stock sale del cliente.
    // `pageSize` alto: hace falta el catálogo completo, no una página.
    useEffect(() => {
        if (tipoVenta !== "firme" || !depositosListos) return;

        let vigente = true;
        // Se vacía al empezar para no mostrar el stock del depósito anterior
        // mientras llega la respuesta (la selección ya se reseteó al cambiar).
        setLibros([]);
        listLibros({ pageSize: 1000, deposito_id: depositoId === "" ? undefined : depositoId }).then((r) => {
            if (vigente) setLibros(r.items);
        });
        return () => {
            vigente = false;
        };
    }, [tipoVenta, depositoId, depositosListos]);

    const librosDisponibles: LibroDisponible[] = useMemo(() => {
        if (tipoVenta === "consignacion") {
            return stockConsignado.map((s) => ({ isbn: s.isbn, titulo: s.titulo, precio: s.precio, stock: s.stock }));
        }
        // Venta en firme: stock del depósito elegido. Si no hay depósito
        // elegido todavía, se usa el del principal. Con depósito elegido no
        // se cae al principal: un libro sin dato o sin stock en ese depósito
        // vale 0, para no ofrecer stock que después el backend rechaza.
        return libros.map((l) => ({
            isbn: l.isbn,
            titulo: l.titulo,
            precio: l.precio,
            stock: depositoId === "" ? l.disponible_principal : (l.disponible_en_deposito ?? 0)
        }));
    }, [tipoVenta, stockConsignado, libros, depositoId]);

    const { seleccionados, agregar, actualizar, quitar, reset: resetSeleccion, total } = useSeleccionLibros(librosDisponibles);

    const resetForm = () => {
        setTipoVenta("");
        setClienteId("");
        setDescuento("0");
        setMedioPago("");
        setFechaVenta("");
        setStockConsignado([]);
        resetSeleccion();
        // El depósito elegido se mantiene entre ventas: sólo se resetea la
        // selección de libros.
    };

    const handleTipoVentaChange = (value: TipoVenta | "") => {
        setTipoVenta(value);
        setClienteId("");
        resetSeleccion();
        setStockConsignado([]);
    };

    // Cambiar de depósito en una venta en firme: resetear la selección de
    // libros porque el stock disponible cambia.
    const handleDepositoChange = (id: number | "") => {
        setDepositoId(id);
        resetSeleccion();
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

    // Aplica la precarga de libros una vez que la lista que corresponde al
    // tipo de venta ya está cargada: el catálogo en "firme", y el stock del
    // cliente en "consignación" (que recién llega después de elegir el
    // cliente y es contra el que `agregar` valida).
    const appliedIsbns = useRef(false);
    useEffect(() => {
        if (appliedIsbns.current) return;
        if (!initial?.isbns?.length) return;
        if (tipoVenta === "" || librosDisponibles.length === 0) return;
        appliedIsbns.current = true;
        initial.isbns.forEach((isbn) => agregar(isbn, 1));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tipoVenta, librosDisponibles]);

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
                          tipo_cbte: tipoCbte,
                          deposito_id: depositoId === "" ? undefined : depositoId
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
        depositos,
        depositoId,
        tipoVenta,
        clienteId,
        descuento,
        medioPago,
        fechaVenta,
        librosDisponibles,
        seleccionados,
        total,
        submitting,
        // Nombre del depósito principal: fallback de la ayuda mientras
        // todavía no hay un depósito elegido.
        depositoPrincipal,
        setTipoVenta: handleTipoVentaChange,
        setClienteId: handleClienteChange,
        setDepositoId: handleDepositoChange,
        setDescuento,
        setMedioPago,
        setFechaVenta,
        agregarLibro: agregar,
        actualizarCantidadLibro: actualizar,
        quitarLibro: quitar,
        submit
    };
}
