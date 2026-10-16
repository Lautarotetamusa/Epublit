import { useLocation, useNavigate } from "react-router-dom";
import { Button, Card, Tabs } from "../../design-system";
import { useLiquidaciones } from "./useLiquidaciones";
import { useAnticipos } from "./useAnticipos";
import { TablaLiquidaciones } from "./TablaLiquidaciones";
import { TablaAnticipos } from "./TablaAnticipos";

// Sección "lo que se le paga a los autores": liquidaciones de ventas y
// anticipos de lanzamiento. Son dos listados del mismo tema, no dos secciones de
// navegación, así que van como pestañas de una pantalla. La pestaña activa vive
// en la ruta (`/liquidaciones` y `/liquidaciones/anticipos`) para que cada una
// tenga su enlace.
export function LiquidacionesPage() {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const enAnticipos = pathname.endsWith("/anticipos");

    const { liquidaciones, loading } = useLiquidaciones();
    const { anticipos, loading: cargandoAnticipos, marcarPagado } = useAnticipos();

    return (
        <Card
            title={enAnticipos ? "Anticipos" : "Liquidaciones"}
            subtitle={
                enAnticipos
                    ? "Lo que cobra cada rol al lanzar un libro. Una reimpresión no genera un anticipo nuevo."
                    : "Lo que le corresponde a cada autor por las ventas de un período. Se puede pagar en partes."
            }
            actions={
                enAnticipos ? undefined : (
                    <Button iconStart="plus" onClick={() => navigate("/liquidaciones/nueva")}>
                        Nueva liquidación
                    </Button>
                )
            }
            padded={false}
        >
            <div style={{ padding: "var(--space-3) var(--space-5) 0" }}>
                <Tabs
                    items={[
                        { value: "liquidaciones", label: "Liquidaciones", count: liquidaciones.length },
                        { value: "anticipos", label: "Anticipos", count: anticipos.length }
                    ]}
                    value={enAnticipos ? "anticipos" : "liquidaciones"}
                    onChange={(value) => navigate(value === "anticipos" ? "/liquidaciones/anticipos" : "/liquidaciones")}
                />
            </div>

            {enAnticipos ? (
                <TablaAnticipos anticipos={anticipos} loading={cargandoAnticipos} onMarcarPagado={marcarPagado} />
            ) : (
                <TablaLiquidaciones liquidaciones={liquidaciones} loading={loading} />
            )}
        </Card>
    );
}
