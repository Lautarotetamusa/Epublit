import { useNavigate } from "react-router-dom";
import { Button, Card, EmptyState, Icon, Table } from "../../design-system";
import type { Libro } from "../../api/libro";
import type { StockEnDeposito } from "../../api/deposito";
import { mockDesgloseDeLibro } from "../depositos/depositosMock";

// El stock de un libro: el total (suma de los depósitos, sólo lectura) y el
// desglose de en qué depósitos está y cuánto en cada uno. No hay ningún campo
// para editarlo: para cargar o corregir ejemplares se registra un movimiento.
export function StockLibroCard({ libro }: { libro: Libro }) {
    const navigate = useNavigate();
    const total = libro.stock ?? 0;
    const depositos = mockDesgloseDeLibro(libro.isbn, total);
    const irAIngreso = () => navigate(`/movimientos/nuevo?tipo=ingreso&isbns=${libro.isbn}`);

    return (
        <Card
            title="Stock"
            subtitle="La suma de los depósitos donde está el libro. Sólo se modifica con movimientos."
            padded={false}
            actions={
                <Button variant="secondary" size="sm" iconStart="arrow-right" onClick={irAIngreso}>
                    Registrar movimiento
                </Button>
            }
        >
            <div style={{ padding: "var(--space-5)" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)" }}>
                    <span
                        style={{
                            fontFamily: "var(--font-display)",
                            fontSize: "var(--text-2xl)",
                            fontWeight: "var(--weight-semibold)",
                            fontVariantNumeric: "tabular-nums"
                        }}
                    >
                        {total.toLocaleString("es-AR")}
                    </span>
                    <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                        {total === 1 ? "ejemplar en total" : "ejemplares en total"}
                    </span>
                </div>
            </div>

            <Table
                columns={[
                    {
                        header: "Depósito",
                        cell: (row: StockEnDeposito) => (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
                                <Icon name="building-2" size={14} color="var(--text-subtle)" />
                                {row.nombre}
                                {row.principal ? <span style={{ color: "var(--text-subtle)" }}>(principal)</span> : null}
                            </span>
                        )
                    },
                    { header: "Ejemplares", key: "cantidad", align: "right", mono: true }
                ]}
                rows={depositos}
                onRowClick={(row: StockEnDeposito) => navigate(`/depositos/${row.id}`)}
                empty={
                    <EmptyState
                        icon="boxes"
                        title="Todavía no tiene stock"
                        description="Cargá ejemplares con un ingreso desde el exterior, o pasalos desde otro depósito."
                        action={
                            <Button iconStart="plus" onClick={irAIngreso}>
                                Registrar ingreso
                            </Button>
                        }
                    />
                }
            />
        </Card>
    );
}
