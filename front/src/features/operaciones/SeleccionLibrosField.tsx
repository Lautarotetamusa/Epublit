import { useState } from "react";
import type { KeyboardEvent } from "react";
import { Field, Combobox, Button, Table, IconButton, QuantityStepper } from "../../design-system";
import type { LibroDisponible, ItemSeleccionado } from "./useSeleccionLibros";
import { useToast } from "../../notifications/ToastProvider";

type Props = {
    librosDisponibles: LibroDisponible[];
    seleccionados: ItemSeleccionado[];
    onAgregar: (isbn: string, cantidad: number) => string | null;
    onActualizarCantidad: (isbn: string, cantidad: number) => string | null;
    onQuitar: (isbn: string) => void;
    disabled?: boolean;
    placeholder?: string;
};

// Picker de "libro + cantidad" + tabla de seleccionados con total: la misma
// pieza que usan venta/consignación/devolución (ver useSeleccionLibros.ts).
// El picker va arriba de la tabla (se completa antes de poder revisarla) y
// la cantidad de cada fila ya cargada se edita ahí mismo con +/- (QuantityStepper),
// sin tener que quitarla y volver a agregarla ni tipear a mano.
export function SeleccionLibrosField({ librosDisponibles, seleccionados, onAgregar, onActualizarCantidad, onQuitar, disabled, placeholder }: Props) {
    const { showToast } = useToast();
    const [isbn, setIsbn] = useState("");
    const [cantidad, setCantidad] = useState(1);

    const libroElegido = librosDisponibles.find((l) => l.isbn === isbn);

    const handleAgregar = () => {
        if (!isbn) {
            showToast("warning", "Debés completar libro y cantidad");
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

    const handleActualizarCantidad = (row: ItemSeleccionado, nuevaCantidad: number) => {
        if (nuevaCantidad === row.cantidad) return;
        const error = onActualizarCantidad(row.isbn, nuevaCantidad);
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
                        options={librosDisponibles.map((l) => ({
                            value: l.isbn,
                            label: l.stock > 0 ? `${l.titulo} (${l.stock})` : `${l.titulo} (sin stock)`,
                            disabled: l.stock === 0
                        }))}
                        placeholder={placeholder ?? "Buscá un libro"}
                        emptyMessage="No se encontraron libros"
                        disabled={disabled}
                    />
                </Field>
                <Field label="Cantidad">
                    <QuantityStepper
                        value={cantidad}
                        min={1}
                        max={libroElegido?.stock}
                        onChange={setCantidad}
                        onKeyDown={handleCantidadKeyDown}
                        disabled={disabled || !isbn}
                    />
                </Field>
                <Button variant="secondary" onClick={handleAgregar} disabled={disabled}>
                    Agregar
                </Button>
            </div>

            {seleccionados.length > 0 ? (
                <>
                    <Table
                        style={{ marginTop: "var(--space-5)" }}
                        columns={[
                            { header: "Título", key: "titulo" },
                            {
                                header: "Cantidad",
                                align: "right",
                                cell: (row: ItemSeleccionado) => (
                                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                        <QuantityStepper
                                            size="sm"
                                            value={row.cantidad}
                                            min={1}
                                            max={librosDisponibles.find((l) => l.isbn === row.isbn)?.stock}
                                            onChange={(nuevaCantidad) => handleActualizarCantidad(row, nuevaCantidad)}
                                        />
                                    </div>
                                )
                            },
                            { header: "Precio unitario", align: "right", cell: (row) => row.precio.toLocaleString("es-AR") },
                            {
                                header: "",
                                align: "right",
                                cell: (row) => <IconButton icon="x" label="Quitar" variant="ghost" onClick={() => onQuitar(row.isbn)} />
                            }
                        ]}
                        rows={seleccionados}
                    />
                    <p style={{ textAlign: "right", marginTop: "var(--space-2)", fontFamily: "var(--font-mono)" }}>
                        Total: {seleccionados.reduce((acc, item) => acc + item.cantidad * item.precio, 0).toLocaleString("es-AR")}
                    </p>
                </>
            ) : null}
        </div>
    );
}
