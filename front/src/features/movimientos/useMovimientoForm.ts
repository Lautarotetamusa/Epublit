import { useEffect, useRef, useState } from "react";
import type { Deposito, Extremo, ExtremoInput, Movimiento, TipoMovimiento } from "../../api/deposito";
import { createMovimiento, faltantesDeStock, getDepositoLibros } from "../../api/deposito";
import type { FaltanteStock } from "../../api/deposito";
import { getErrorMessage } from "../../lib/errors";
import { useCatalogoParaStock } from "../depositos/useCatalogoParaStock";
import { useDepositos } from "../depositos/useDepositos";
import type { PrecargaMovimiento } from "./precargaMovimiento";

export type LibroParaMover = {
    isbn: string;
    titulo: string;
    // `null` = sin disponible conocido: el origen es el exterior, o todavía no
    // llegó la cantidad del depósito elegido. Cuando es un número es lo que hay
    // en el origen, que es lo que limita cada línea.
    disponible: number | null;
};

type LineaGuardada = {
    isbn: string;
    titulo: string;
    cantidad: number;
};

export type LineaMovimiento = LibroParaMover & { cantidad: number };

function opcionDe(deposito: Deposito) {
    return { value: String(deposito.id), label: deposito.principal ? `${deposito.nombre} (principal)` : deposito.nombre };
}

// Toda la lógica y el estado de "Nuevo movimiento": elegir el caso (ingreso,
// baja o transferencia), los dos extremos y los libros con su cantidad, y
// registrar la operación entera o ninguna. La pantalla sólo renderiza lo que
// expone este hook.
export function useMovimientoForm(precarga: PrecargaMovimiento | undefined, onCreated: (movimiento: Movimiento) => void) {
    const { catalogo, loading: loadingCatalogo } = useCatalogoParaStock();
    const { depositos, loading: loadingDepositos } = useDepositos();

    const [tipo, setTipo] = useState<TipoMovimiento>(() => precarga?.tipo ?? "transferencia");
    const [origenId, setOrigenId] = useState<number | "">(() => precarga?.origenId ?? "");
    const [destinoId, setDestinoId] = useState<number | "">(() => precarga?.destinoId ?? "");
    const [lineas, setLineas] = useState<LineaGuardada[]>([]);
    const [faltantesServidor, setFaltantesServidor] = useState<FaltanteStock[]>([]);
    const [avisoPrecarga, setAvisoPrecarga] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    // Cantidades del depósito de origen, por isbn: `GET /deposito/:id/libros`.
    // Se vuelven a pedir cuando cambia el origen o después de un rechazo por
    // stock (el saldo pudo cambiar desde el render).
    const [disponiblePorIsbn, setDisponiblePorIsbn] = useState<Map<string, number>>(new Map());
    const [disponibleCargado, setDisponibleCargado] = useState(false);
    const [revision, setRevision] = useState(0);

    const principal = depositos.find((deposito) => deposito.principal) ?? null;
    const esIngreso = tipo === "ingreso";

    // El depósito principal recién se conoce cuando termina de cargar el
    // listado: se usa como default del extremo elegible una sola vez.
    const defaultsAplicados = useRef(false);
    useEffect(() => {
        if (defaultsAplicados.current || !principal) return;
        defaultsAplicados.current = true;
        if (esIngreso && destinoId === "") setDestinoId(principal.id);
        if (!esIngreso && origenId === "") setOrigenId(principal.id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [principal]);

    const depositoOrigen = !esIngreso && origenId !== "" ? (depositos.find((d) => d.id === origenId) ?? null) : null;
    const depositoDestino = tipo !== "baja" && destinoId !== "" ? (depositos.find((d) => d.id === destinoId) ?? null) : null;

    // Un ingreso no tiene saldo en el origen (es el exterior), así que no hay
    // cantidades que pedir. En baja/transferencia, en cambio, lo disponible es
    // lo que hay del libro en el depósito de origen.
    useEffect(() => {
        if (esIngreso || origenId === "") {
            setDisponiblePorIsbn(new Map());
            setDisponibleCargado(esIngreso);
            return;
        }

        let cancelado = false;
        setDisponibleCargado(false);
        getDepositoLibros(origenId).then((response) => {
            if (cancelado) return;
            setDisponiblePorIsbn(new Map(response.data.libros.map((libro) => [libro.isbn, libro.cantidad])));
            setDisponibleCargado(true);
        });
        return () => {
            cancelado = true;
        };
    }, [esIngreso, origenId, revision]);

    const refrescarDisponible = () => setRevision((actual) => actual + 1);

    // Sin disponible conocido (exterior, o el depósito todavía no cargó) la
    // línea no se limita; con el depósito cargado, lo que no está en el mapa
    // está en 0.
    const disponibleDe = (isbn: string): number | null => {
        if (esIngreso || !disponibleCargado) return null;
        return disponiblePorIsbn.get(isbn) ?? 0;
    };

    const librosParaMover: LibroParaMover[] = catalogo.map((libro) => ({
        isbn: libro.isbn,
        titulo: libro.titulo,
        disponible: disponibleDe(libro.isbn)
    }));

    const lineasConDisponible: LineaMovimiento[] = lineas.map((linea) => ({ ...linea, disponible: disponibleDe(linea.isbn) }));

    // Lo que falta en el origen, calculado en el cliente para poder avisarlo
    // antes de mandar el movimiento (y no después, cuando ya "parece" hecho).
    const faltantes: FaltanteStock[] = lineasConDisponible
        .filter((linea) => linea.disponible !== null && linea.cantidad > linea.disponible)
        .map((linea) => ({
            isbn: linea.isbn,
            titulo: linea.titulo,
            pedida: linea.cantidad,
            disponible: linea.disponible ?? 0
        }));

    const faltantesAMostrar = faltantesServidor.length > 0 ? faltantesServidor : faltantes;

    const agregar = (isbn: string, cantidad: number): string | null => {
        const libro = catalogo.find((l) => l.isbn === isbn);
        if (!libro) return "El libro seleccionado no está disponible";

        // A propósito no se corta acá si la cantidad supera lo disponible: la
        // pantalla deja pedir de más y avisa antes de registrar (ver
        // `faltantes`), porque el movimiento es atómico y hay que poder mostrar
        // que no se movió nada.
        setFaltantesServidor([]);
        setLineas((actual) =>
            actual.some((linea) => linea.isbn === isbn)
                ? actual.map((linea) => (linea.isbn === isbn ? { ...linea, cantidad: linea.cantidad + cantidad } : linea))
                : [...actual, { isbn, titulo: libro.titulo, cantidad }]
        );
        return null;
    };

    const actualizar = (isbn: string, cantidad: number): string | null => {
        if (cantidad < 1) return "La cantidad tiene que ser al menos 1";

        setFaltantesServidor([]);
        setLineas((actual) => actual.map((linea) => (linea.isbn === isbn ? { ...linea, cantidad } : linea)));
        return null;
    };

    const quitar = (isbn: string) => {
        setFaltantesServidor([]);
        setLineas((actual) => actual.filter((linea) => linea.isbn !== isbn));
    };

    const cambiarTipo = (nuevo: TipoMovimiento) => {
        setTipo(nuevo);
        setFaltantesServidor([]);
        // Cada tipo deja un extremo fijo (el exterior) y otro seleccionable; el
        // seleccionable arranca en el depósito principal si no había nada elegido.
        if (nuevo === "ingreso" && destinoId === "") setDestinoId(principal?.id ?? "");
        if (nuevo !== "ingreso" && origenId === "") setOrigenId(principal?.id ?? "");
        if (nuevo === "transferencia" && origenId !== "" && origenId === destinoId) setDestinoId("");
    };

    const elegirOrigen = (id: number | "") => {
        setOrigenId(id);
        setFaltantesServidor([]);
        if (id !== "" && id === destinoId) setDestinoId("");
    };

    const elegirDestino = (id: number | "") => {
        setDestinoId(id);
        setFaltantesServidor([]);
    };

    // Precarga de libros desde otra pantalla, una sola vez y cuando ya se sabe
    // lo disponible en el origen (el catálogo y las cantidades del depósito).
    // Sólo entran los que tienen algo en el origen: los que no, se omiten y se
    // avisa cuántos quedaron afuera (si los metiéramos, el movimiento llegaría
    // ya inválido).
    const precargaAplicada = useRef(false);
    useEffect(() => {
        if (precargaAplicada.current || catalogo.length === 0 || !precarga?.isbns?.length) return;
        if (!esIngreso && !disponibleCargado) return;
        precargaAplicada.current = true;

        const omitidos = [...new Set(precarga.isbns)].filter((isbn) => disponibleDe(isbn) === 0 || agregar(isbn, 1) !== null);
        if (omitidos.length === 1) setAvisoPrecarga(`«${omitidos[0]}» no tiene stock en el origen, así que no se agregó al movimiento.`);
        if (omitidos.length > 1) setAvisoPrecarga(`${omitidos.length} libros no tienen stock en el origen y no se agregaron al movimiento.`);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [catalogo, disponibleCargado, esIngreso]);

    const extremoOrigen = (): ExtremoInput | null => {
        if (esIngreso) return { tipo: "exterior" };
        return origenId === "" ? null : { tipo: "deposito", id: Number(origenId) };
    };

    const extremoDestino = (): ExtremoInput | null => {
        if (tipo === "baja") return { tipo: "exterior" };
        return destinoId === "" ? null : { tipo: "deposito", id: Number(destinoId) };
    };

    const submit = async (): Promise<string | null> => {
        if (lineas.length === 0) return "Agregá al menos un libro al movimiento";
        const origen = extremoOrigen();
        const destino = extremoDestino();
        if (!origen) return "Elegí el depósito de origen";
        if (!destino) return "Elegí el depósito de destino";
        if (faltantes.length > 0) {
            return `No hay stock suficiente en «${depositoOrigen?.nombre}». No se movió nada.`;
        }

        setSubmitting(true);
        try {
            const response = await createMovimiento({
                origen,
                destino,
                libros: lineas.map((linea) => ({ isbn: linea.isbn, cantidad: linea.cantidad }))
            });

            setLineas([]);
            setFaltantesServidor([]);
            refrescarDisponible();
            onCreated(response.data);
            return null;
        } catch (err) {
            const faltantesReales = faltantesDeStock(err);
            if (faltantesReales) {
                // Rechazo atómico del backend (no aplicó nada, ver el plan): se
                // muestran los faltantes reales y se refresca lo disponible, sin
                // tocar la selección para poder corregir las cantidades.
                setFaltantesServidor(faltantesReales);
                refrescarDisponible();
                return `No hay stock suficiente en «${depositoOrigen?.nombre}». No se movió nada.`;
            }

            // Cualquier otro rechazo (400/404) se muestra tal cual lo devuelve
            // el backend.
            return getErrorMessage(err);
        } finally {
            setSubmitting(false);
        }
    };

    const origen: Extremo | null = esIngreso
        ? { tipo: "exterior" }
        : depositoOrigen
          ? { tipo: "deposito", id: depositoOrigen.id, nombre: depositoOrigen.nombre }
          : null;

    const destino: Extremo | null =
        tipo === "baja"
            ? { tipo: "exterior" }
            : depositoDestino
              ? { tipo: "deposito", id: depositoDestino.id, nombre: depositoDestino.nombre }
              : null;

    return {
        loading: loadingCatalogo || loadingDepositos,
        tipo,
        cambiarTipo,
        origenId,
        destinoId,
        elegirOrigen,
        elegirDestino,
        depositoOrigen,
        origen,
        destino,
        // Sólo una transferencia tiene un depósito en cada punta: en un ingreso
        // o una baja el otro extremo es el exterior, así que no hay nada que
        // excluir de la lista.
        depositosOrigen: depositos.filter((d) => tipo !== "transferencia" || d.id !== destinoId).map(opcionDe),
        depositosDestino: depositos.filter((d) => tipo !== "transferencia" || d.id !== origenId).map(opcionDe),
        librosParaMover,
        seleccionados: lineasConDisponible,
        agregar,
        actualizar,
        quitar,
        faltantes: faltantesAMostrar,
        avisoPrecarga,
        limpiarAvisoPrecarga: () => setAvisoPrecarga(null),
        submitting,
        submit
    };
}
