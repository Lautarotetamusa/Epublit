import { useNavigate } from "react-router-dom";
import { Button, Card, EmptyState, Pagination, Table } from "../../design-system";
import type { Operacion } from "../../api/operaciones";
import { useConsignaciones } from "./useConsignaciones";
import { useClientPagination } from "../../lib/useClientPagination";

export function ConsignacionesPage() {
    const { consignaciones, loading } = useConsignaciones();
    const { page, setPage, pageCount, pageItems, total } = useClientPagination(consignaciones);
    const navigate = useNavigate();

    return (
        <Card
            title="Consignaciones"
            actions={
                <Button iconStart="plus" onClick={() => navigate("/consignaciones/nueva")}>
                    Nueva consignación
                </Button>
            }
            padded={false}
        >
            <Table
                columns={[
                    { header: "ID", key: "id" },
                    { header: "Cliente", key: "nombre_cliente" },
                    { header: "CUIT", key: "cuit", mono: true },
                    { header: "Fecha", cell: (row: Operacion) => new Date(row.fecha).toLocaleDateString("es-AR") }
                ]}
                rows={pageItems}
                onRowClick={(row: Operacion) => navigate(`/consignaciones/${row.id}`)}
                empty={loading ? "Cargando..." : <EmptyState icon="boxes" title="Todavía no hay consignaciones" />}
            />
            {total > 0 ? (
                <div style={{ padding: "var(--space-4)" }}>
                    <Pagination page={page} pageCount={pageCount} total={total} onChange={setPage} />
                </div>
            ) : null}
        </Card>
    );
}
