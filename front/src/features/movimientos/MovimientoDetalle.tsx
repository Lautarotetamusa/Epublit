import { Button, Icon, Table } from "../../design-system";
import type { LibroEnMovimiento, Movimiento } from "../../api/deposito";
import { tiposComprobante } from "../../api/operaciones";
import { ExtremoDisplay } from "./ExtremoDisplay";
import { resumirLibros } from "./movimientoFormato";

// El número de comprobante AFIP se muestra con su nombre; si el backend agrega
// uno que el front todavía no conoce, se cae al número crudo.
const etiquetaComprobante = (tipoCbte: number): string =>
    tiposComprobante.find((tipo) => tipo.value === tipoCbte)?.label ?? `Comprobante ${tipoCbte}`;

// La consignación y la devolución dejan un remito; las ventas, un comprobante.
const etiquetaArchivo = (movimiento: Movimiento): string =>
    movimiento.tipo === "consignacion" || movimiento.tipo === "devolucion" ? "Ver remito" : "Ver comprobante";

function Dato({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <dt
                style={{
                    fontSize: "var(--text-2xs)",
                    textTransform: "uppercase",
                    letterSpacing: "var(--tracking-caps)",
                    color: "var(--text-muted)"
                }}
            >
                {label}
            </dt>
            <dd style={{ margin: "4px 0 0" }}>{value}</dd>
        </div>
    );
}

// Cuerpo del detalle de un movimiento: la ruta, cada libro con su cantidad y,
// cuando es comercial, el cliente, los datos de la venta y el archivo emitido.
// Es presentación pura para que la ficha (con fetch propio) no cargue también
// el armado del detalle.
export function MovimientoDetalle({ movimiento }: { movimiento: Movimiento }) {
    const tienePrecio = movimiento.libros.some((libro) => libro.precio != null);
    const { cliente, venta } = movimiento;
    const filePath = movimiento.file_path;

    return (
        <>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto 1fr",
                    gap: "var(--space-3)",
                    alignItems: "center"
                }}
            >
                <ExtremoDisplay extremo={movimiento.origen} variante="fijo" />
                <Icon name="arrow-right" size={17} color="var(--text-subtle)" />
                <ExtremoDisplay extremo={movimiento.destino} variante="fijo" />
            </div>

            {cliente || venta ? (
                <dl
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, 1fr)",
                        gap: "var(--space-4)",
                        margin: "var(--space-5) 0 0"
                    }}
                >
                    {cliente ? <Dato label="Cliente" value={cliente.nombre} /> : null}
                    {venta ? <Dato label="Comprobante" value={etiquetaComprobante(venta.tipo_cbte)} /> : null}
                    {venta?.medio_pago ? <Dato label="Medio de pago" value={venta.medio_pago.nombre} /> : null}
                    {venta ? <Dato label="Total" value={venta.total.toLocaleString("es-AR")} /> : null}
                </dl>
            ) : null}

            <Table
                style={{ marginTop: "var(--space-5)" }}
                columns={[
                    { header: "Título", key: "titulo" },
                    { header: "ISBN", key: "isbn", mono: true, muted: true },
                    ...(tienePrecio
                        ? [
                              {
                                  header: "Precio",
                                  align: "right" as const,
                                  mono: true,
                                  cell: (row: LibroEnMovimiento) =>
                                      row.precio != null ? row.precio.toLocaleString("es-AR") : "—"
                              }
                          ]
                        : []),
                    { header: "Cantidad", key: "cantidad", align: "right", mono: true }
                ]}
                rows={movimiento.libros}
            />

            <p style={{ marginTop: "var(--space-3)", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                {resumirLibros(movimiento.libros)}
            </p>

            {filePath ? (
                <div style={{ marginTop: "var(--space-4)" }}>
                    <Button variant="secondary" iconStart="file-text" onClick={() => window.open(filePath, "_blank")}>
                        {etiquetaArchivo(movimiento)}
                    </Button>
                </div>
            ) : null}
        </>
    );
}
