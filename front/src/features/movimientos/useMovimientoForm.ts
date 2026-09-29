import { useEffect, useRef, useState } from "react";
import type { Deposito, Extremo, ExtremoInput, Movimiento, TipoMovimiento } from "../../api/deposito";
import { useCatalogoParaStock } from "../depositos/useCatalogoParaStock";
import { mockBuscarDeposito, mockCantidadEnDeposito, mockDepositoPrincipal, mockListarDepositos, mockRegistrarMovimiento } from "../depositos/depositosMock";
import type { FaltanteStock } from "../depositos/depositosMock";
import type { PrecargaMovimiento } from "./precargaMovimiento";

export type LibroParaMover = {
    isbn: string;
    titulo: string;
    // `null` = sin tope. Cuando el origen es el exterior no hay saldo que
    // respetar: un ingreso siempre entra.
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
    const { catalogo, loading } = useCatalogoParaStock();
    const principal = mockDepositoPrincipal();

    const [tipo, setTipo] = useState<TipoMovimiento>(() => precarga?.tipo ?? "transferencia");
    const [origenId, setOrigenId] = useState<number | "">(() => precarga?.origenId ?? principal.id);
    const [destinoId, setDestinoId] = useState<number | "">(() => {
        if (precarga?.destinoId !== undefined) return precarga.destinoId;
        // En una transferencia los extremos no pueden coincidir, así que el
        // destino arranca sin elegir; en un ingreso el que se elige es el
        // destino y el default natural es el principal.
        return (precarga?.tipo ?? "transferencia") === "transferencia" ? "" : principal.id;
    });
    const [lineas, setLineas] = useState<LineaGuardada[]>([]);
    const [faltantesServidor, setFaltantesServidor] = useState<FaltanteStock[]>([]);
    const [avisoPrecarga, setAvisoPrecarga] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    // El mock es una estructura mutable: después de registrar un movimiento no
    // hay un dato nuevo que guardar, hace falta forzar el re-render para que
    // `disponibleDe` vuelva a leer las cantidades.
    const [, setRevision] = useState(0);
    const refrescar = () => setRevision((actual) => actual + 1);

    const depositos = mockListarDepositos();
    const esIngreso = tipo === "ingreso";
    const depositoOrigen = !esIngreso && origenId !== "" ? mockBuscarDeposito(origenId) : null;
    const depositoDestino = tipo !== "baja" && destinoId !== "" ? mockBuscarDeposito(destinoId) : null;

    // Cuánto hay de un libro en el origen. Es lo que limita cada línea (y lo que
    // el backend vuelve a validar al registrar: ver mockRegistrarMovimiento).
    const disponibleDe = (isbn: string): number | null => {
        if (!depositoOrigen) return null;
        const stockApi = catalogo.find((libro) => libro.isbn === isbn)?.stock ?? 0;
        return mockCantidadEnDeposito(depositoOrigen.id, isbn, stockApi);
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
        if (nuevo === "ingreso" && destinoId === "") setDestinoId(principal.id);
        if (nuevo !== "ingreso" && origenId === "") setOrigenId(principal.id);
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

    // Precarga de libros desde otra pantalla, una sola vez y cuando el catálogo
    // ya está. Sólo entran los que tienen algo en el origen: los que no, se
    // omiten y se avisa cuántos quedaron afuera (si los metiéramos, el
    // movimiento llegaría ya inválido).
    const precargaAplicada = useRef(false);
    useEffect(() => {
        if (precargaAplicada.current || catalogo.length === 0 || !precarga?.isbns?.length) return;
        precargaAplicada.current = true;

        const omitidos = [...new Set(precarga.isbns)].filter((isbn) => disponibleDe(isbn) === 0 || agregar(isbn, 1) !== null);
        if (omitidos.length === 1) setAvisoPrecarga(`«${omitidos[0]}» no tiene stock en el origen, así que no se agregó al movimiento.`);
        if (omitidos.length > 1) setAvisoPrecarga(`${omitidos.length} libros no tienen stock en el origen y no se agregaron al movimiento.`);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [catalogo]);

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
        const resultado = mockRegistrarMovimiento(
            { origen, destino, libros: lineas.map((linea) => ({ isbn: linea.isbn, cantidad: linea.cantidad })) },
            catalogo
        );
        setSubmitting(false);
        refrescar();

        if (!resultado.ok) {
            // El rechazo no dejó nada a medio mover (ver mockRegistrarMovimiento):
            // se refresca lo disponible y la selección queda intacta para que se
            // puedan corregir las cantidades.
            setFaltantesServidor(resultado.faltantes);
            return `No hay stock suficiente en «${depositoOrigen?.nombre}». No se movió nada.`;
        }

        setLineas([]);
        setFaltantesServidor([]);
        onCreated(resultado.movimiento);
        return null;
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
        loading,
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
