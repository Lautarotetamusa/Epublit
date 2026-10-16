import { useNavigate, useParams } from "react-router-dom";
import { Breadcrumb, Card } from "../../design-system";
import { getDevolucion } from "../../api/operaciones";
import { FullscreenSpinner } from "../../components/FullscreenSpinner";
import { DetalleOperacion } from "./DetalleOperacion";
import { useOperacionDetalle } from "./useOperacionDetalle";

export function FichaDevolucionPage() {
    const { id = "" } = useParams();
    const { operacion, loading } = useOperacionDetalle(Number(id), getDevolucion);
    const navigate = useNavigate();

    if (loading || !operacion) return <FullscreenSpinner />;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Breadcrumb
                items={["Devoluciones", `Devolución #${operacion.id}`]}
                onNavigate={(_item, index) => index === 0 && navigate("/devoluciones")}
            />
            <Card title={`Devolución #${operacion.id}`} subtitle={operacion.nombre_cliente}>
                <DetalleOperacion operacion={operacion} />
            </Card>
        </div>
    );
}
