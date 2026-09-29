import { useState } from "react";
import type { KeyboardEvent } from "react";
import { Button, Combobox, Field, IconButton, QuantityStepper, Table } from "../../design-system";
import { useToast } from "../../notifications/ToastProvider";
import type { LibroParaMover, LineaMovimiento } from "./useMovimientoForm";

type Props = {
    libros: LibroParaMover[];
    seleccionados: LineaMovimiento[];
    // Nombre del depósito del que sale el stock. `null` cuando el origen es el
    // exterior: no hay nada que limitar y no se muestra la columna de disponible.
    origenNombre: string | null;
    onAgregar: (isbn: string, cantidad: number) => string | null;
    onActualizarCantidad: (isbn: string, cantidad: number) => string | null;
    onQuitar: (isbn: string) => void;
};

// Selección de "libro + cantidad" para un movimiento. Misma pieza base que usan
// venta/consignación/devolución (ver SeleccionLibrosField), pero sin precio
// —un movimiento no toca el precio del libro— y mostrando lo que hay en el
// depósito de origen.
//
// Las cantidades NO se topean contra lo disponible: la pantalla deja pedir de
// más y avisa antes de registrar el movimiento (ver MovimientosPage), porque la
// operación es atómica y lo que hay que hacer visible es que no se mueve nada.
export function SeleccionLibrosMovimiento({ libros, seleccionados, origenNombre, onAgregar, onActualizarCantidad, onQuitar }: Props) {
    const { showToast } = useToast();
    const [isbn, setIsbn] = useState("");
    const [cantidad, setCantidad] = useState(1);

    const etiquetaDe = (libro: LibroParaMover): string => {
        if (libro.disponible === null) return libro.titulo;
        if (libro.disponible === 0) return `${libro.titulo} (sin stock en ${origenNombre})`;
        return `${libro.titulo} (${libro.disponible})`;
    };

    const handleAgregar = () => {
        if (!isbn) {
            showToast("warning", "Elegí un libro y una cantidad");
            return;
        }
        const error = onAgregar(isbn, cantidad);
        if (error) {
            showToast("error", error);
            return;
        }
        setIsbn("");
        setCantidad(1);
    };

    const handleCantidadKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Enter") {
            event.preventDefault();
            handleAgregar();
        }
    };

    const handleActualizarCantidad = (linea: LineaMovimiento, nuevaCantidad: number) => {
        if (nuevaCantidad === linea.cantidad) return;
        const error = onActualizarCantidad(linea.isbn, nuevaCantidad);
        if (error) showToast("error", error);
    };

    return (
        <div>
            <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-end" }}>
                <Field label="Libro" style={{ flex: 1 }}>
                    <Combobox
                        value={isbn}
                        onChange={(value) => {
                            setIsbn(value);
                            setCantidad(1);
                        }}
                        options={libros.map((libro) => ({
                            value: libro.isbn,
                            label: etiquetaDe(libro),
                            disabled: libro.disponible === 0
                        }))}
                        placeholder="Buscá un libro"
                        emptyMessage="No se encontraron libros"
                    />
                </Field>
                <Field label="Cantidad">
                    <QuantityStepper
                        value={cantidad}
                        min={1}
                        onChange={setCantidad}
                        onKeyDown={handleCantidadKeyDown}
                        disabled={!isbn}
                    />
                </Field>
                <Button variant="secondary" onClick={handleAgregar}>
                    Agregar
                </Button>
            </div>

            {seleccionados.length > 0 ? (
                <Table
                    style={{ marginTop: "var(--space-5)" }}
                    columns={[
                        { header: "Título", key: "titulo" },
                        { header: "ISBN", key: "isbn", mono: true, muted: true },
                        ...(origenNombre
                            ? [
                                  {
                                      header: `Disponible en ${origenNombre}`,
                                      align: "right" as const,
                                      mono: true,
                                      cell: (row: LineaMovimiento) => (
                                          <span
                                              style={{
                                                  color: row.cantidad > (row.disponible ?? 0) ? "var(--text-error)" : undefined,
                                                  fontWeight: row.cantidad > (row.disponible ?? 0) ? "var(--weight-semibold)" : undefined
                                              }}
                                          >
                                              {row.disponible}
                                          </span>
                                      )
                                  }
                              ]
                            : []),
                        {
                            header: "Cantidad",
                            align: "right",
                            cell: (row: LineaMovimiento) => (
                                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                    <QuantityStepper
                                        size="sm"
                                        value={row.cantidad}
                                        min={1}
                                        onChange={(nuevaCantidad) => handleActualizarCantidad(row, nuevaCantidad)}
                                    />
                                </div>
                            )
                        },
                        {
                            header: "",
                            align: "right",
                            width: 48,
                            cell: (row: LineaMovimiento) => (
                                <IconButton icon="x" label={`Quitar ${row.titulo}`} variant="ghost" onClick={() => onQuitar(row.isbn)} />
                            )
                        }
                    ]}
                    rows={seleccionados}
                />
            ) : null}
        </div>
    );
}
