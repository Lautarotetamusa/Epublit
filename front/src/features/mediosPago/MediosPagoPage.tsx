import { useNavigate } from "react-router-dom";
import { Button, Card, EmptyState, Table } from "../../design-system";
import { FullscreenSpinner } from "../../components/FullscreenSpinner";
import type { MedioPago } from "../../api/operaciones";
import { useMediosPago } from "./useMediosPago";

export function MediosPagoPage() {
    const { medios, loading } = useMediosPago();
    const navigate = useNavigate();

    if (loading) return <FullscreenSpinner />;

    return (
        <Card
            title="Medios de pago"
            subtitle="Con qué cobrás tus ventas y qué comisión se descuenta de cada una."
            actions={
                <Button iconStart="plus" onClick={() => navigate("/medios-pago/nuevo")}>
                    Nuevo medio de pago
                </Button>
            }
            padded={false}
        >
            <Table
                columns={[
                    { header: "Nombre", key: "nombre" },
                    { header: "Comisión", align: "right", cell: (row: MedioPago) => `${row.comision.toLocaleString("es-AR")}%` }
                ]}
                rows={medios}
                onRowClick={(row: MedioPago) => navigate(`/medios-pago/${row.id}`)}
                empty={
                    <EmptyState
                        icon="banknote"
                        title="Todavía no hay medios de pago"
                        description="Cargá los medios con los que cobrás para elegirlos al registrar una venta."
                    />
                }
            />
        </Card>
    );
}
