import { Button, Table } from "../../design-system";
import type { OperacionDetalle } from "../../api/operaciones";

// Detalle de una operación (consignación o devolución): los libros que movió y
// el remito emitido. Las dos páginas lo comparten; la devolución usa la misma
// plantilla de remito, así que el rótulo del archivo es el mismo.
export function DetalleOperacion({ operacion }: { operacion: OperacionDetalle }) {
    return (
        <>
            <Table
                columns={[
                    { header: "ISBN", key: "isbn", mono: true },
                    { header: "Título", key: "titulo" },
                    { header: "Cantidad", key: "cantidad", align: "right" }
                ]}
                rows={operacion.libros}
            />
            {operacion.file_path ? (
                <div style={{ marginTop: "var(--space-4)" }}>
                    <Button variant="secondary" iconStart="file-text" onClick={() => window.open(operacion.file_path, "_blank")}>
                        Ver remito
                    </Button>
                </div>
            ) : null}
        </>
    );
}
