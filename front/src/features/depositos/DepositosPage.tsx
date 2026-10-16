import { useNavigate } from "react-router-dom";
import { Badge, Button, Card, EmptyState, Table } from "../../design-system";
import type { DepositoConStock } from "../../api/deposito";
import { useDepositos } from "./useDepositos";

export function DepositosPage() {
    const { depositos, loading } = useDepositos();
    const navigate = useNavigate();

    const totalEjemplares = depositos.reduce((total, deposito) => total + deposito.ejemplares, 0);

    return (
        <Card
            title="Depósitos"
            subtitle="El stock de un libro vive en los depósitos: acá se administran."
            actions={
                <Button iconStart="plus" onClick={() => navigate("/depositos/nuevo")}>
                    Nuevo depósito
                </Button>
            }
            padded={false}
            footer={
                depositos.length > 0
                    ? `${depositos.length} depósitos · ${totalEjemplares.toLocaleString("es-AR")} ejemplares en total`
                    : null
            }
        >
            <Table
                columns={[
                    {
                        header: "Nombre",
                        cell: (row: DepositoConStock) => (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-3)" }}>
                                {row.nombre}
                                {row.principal ? (
                                    <Badge tone="brand" dot>
                                        Principal
                                    </Badge>
                                ) : null}
                            </span>
                        )
                    },
                    {
                        header: "Descripción",
                        wrap: true,
                        cell: (row: DepositoConStock) =>
                            row.descripcion ?? <span style={{ color: "var(--text-subtle)" }}>Sin descripción</span>
                    },
                    { header: "Títulos", align: "right", mono: true, cell: (row: DepositoConStock) => row.titulos },
                    { header: "Ejemplares", align: "right", mono: true, cell: (row: DepositoConStock) => row.ejemplares.toLocaleString("es-AR") }
                ]}
                rows={depositos}
                onRowClick={(row: DepositoConStock) => navigate(`/depositos/${row.id}`)}
                empty={
                    loading ? (
                        "Cargando..."
                    ) : (
                        <EmptyState
                            icon="building-2"
                            title="No hay depósitos"
                            description="Todo usuario tiene al menos su depósito principal. Si no ves ninguno, recargá la página."
                        />
                    )
                }
            />
        </Card>
    );
}
