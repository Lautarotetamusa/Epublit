import { useNavigate } from "react-router-dom";
import { Button, Card, EmptyState, Pagination, Table } from "../../design-system";
import type { Operacion } from "../../api/operaciones";
import { useDevoluciones } from "./useDevoluciones";
import { useClientPagination } from "../../lib/useClientPagination";

export function DevolucionesPage() {
    const { devoluciones, loading } = useDevoluciones();
    const { page, setPage, pageCount, pageItems, total } = useClientPagination(devoluciones);
    const navigate = useNavigate();

    return (
        <Card
            title="Devoluciones"
            actions={
                <Button iconStart="plus" onClick={() => navigate("/devoluciones/nueva")}>
                    Nueva devolución
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
                onRowClick={(row: Operacion) => navigate(`/devoluciones/${row.id}`)}
                empty={loading ? "Cargando..." : <EmptyState icon="truck" title="Todavía no hay devoluciones" />}
            />
            {total > 0 ? (
                <div style={{ padding: "var(--space-4)" }}>
                    <Pagination page={page} pageCount={pageCount} total={total} onChange={setPage} />
                </div>
            ) : null}
        </Card>
    );
}
