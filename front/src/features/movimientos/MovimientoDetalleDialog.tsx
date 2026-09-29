import { Button, Dialog, Icon, Table } from "../../design-system";
import type { Movimiento } from "../../api/deposito";
import { ExtremoDisplay } from "./ExtremoDisplay";
import { formatearFecha, resumirLibros, TIPO_MOVIMIENTO, tipoDe } from "./movimientoFormato";

// Detalle de un movimiento. Se abre desde el historial y muestra lo mismo que
// ese renglón pero completo: la ruta, la fecha con hora y cada libro con su
// cantidad. El movimiento ya viene con sus libros (el listado los incluye), así
// que no hace falta otra consulta para abrirlo.
export function MovimientoDetalleDialog({ movimiento, onClose }: { movimiento: Movimiento; onClose: () => void }) {
    const tipo = tipoDe(movimiento);

    return (
        <Dialog
            open
            width={640}
            title={`Movimiento #${movimiento.id}`}
            description={`${TIPO_MOVIMIENTO[tipo].label} · ${formatearFecha(movimiento.fecha, true)}`}
            onClose={onClose}
            footer={
                <Button variant="secondary" onClick={onClose}>
                    Cerrar
                </Button>
            }
        >
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "var(--space-3)", alignItems: "center" }}>
                <ExtremoDisplay extremo={movimiento.origen} variante="fijo" />
                <Icon name="arrow-right" size={17} color="var(--text-subtle)" />
                <ExtremoDisplay extremo={movimiento.destino} variante="fijo" />
            </div>

            <Table
                style={{ marginTop: "var(--space-5)" }}
                columns={[
                    { header: "Título", key: "titulo" },
                    { header: "ISBN", key: "isbn", mono: true, muted: true },
                    { header: "Cantidad", key: "cantidad", align: "right", mono: true }
                ]}
                rows={movimiento.libros}
            />

            <p style={{ marginTop: "var(--space-3)", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                {resumirLibros(movimiento.libros)}
            </p>
        </Dialog>
    );
}
