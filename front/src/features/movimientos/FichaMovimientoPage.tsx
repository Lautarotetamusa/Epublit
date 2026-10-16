import { useNavigate, useParams } from "react-router-dom";
import { Breadcrumb, Card } from "../../design-system";
import { FullscreenSpinner } from "../../components/FullscreenSpinner";
import { MovimientoDetalle } from "./MovimientoDetalle";
import { formatearFecha, TIPO_MOVIMIENTO } from "./movimientoFormato";
import { useFichaMovimiento } from "./useFichaMovimiento";

export function FichaMovimientoPage() {
    const { id = "" } = useParams();
    const { movimiento, loading } = useFichaMovimiento(Number(id));
    const navigate = useNavigate();

    if (loading || !movimiento) return <FullscreenSpinner />;

    const meta = TIPO_MOVIMIENTO[movimiento.tipo];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Breadcrumb
                items={["Movimientos", `Movimiento #${movimiento.id}`]}
                onNavigate={(_item, index) => index === 0 && navigate("/movimientos")}
            />
            <Card
                title={`Movimiento #${movimiento.id}`}
                subtitle={`${meta.label} · ${formatearFecha(movimiento.fecha, true)}`}
            >
                <MovimientoDetalle movimiento={movimiento} />
            </Card>
        </div>
    );
}
