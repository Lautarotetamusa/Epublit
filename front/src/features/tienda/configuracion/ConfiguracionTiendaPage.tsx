import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, Tabs } from "../../../design-system";
import { IntegracionesSection } from "./IntegracionesSection";
import { MercadoPagoSection } from "./MercadoPagoSection";
import { EnviosSection } from "./EnviosSection";

type TabTienda = "integraciones" | "mercadopago" | "envios";

export function ConfiguracionTiendaPage() {
    // El callback de OAuth vuelve con `?mercadopago=conectado`: se abre esa
    // pestaña para que el admin vea el estado recién conectado.
    const [searchParams] = useSearchParams();
    const [tab, setTab] = useState<TabTienda>(searchParams.get("mercadopago") ? "mercadopago" : "integraciones");

    return (
        <Card
            title="Tienda online"
            subtitle="Las integraciones, el cobro y los envíos de tu tienda."
            padded={false}
        >
            <div style={{ padding: "var(--space-4) var(--space-5) 0" }}>
                <Tabs
                    items={[
                        { value: "integraciones", label: "Integraciones" },
                        { value: "mercadopago", label: "MercadoPago" },
                        { value: "envios", label: "Envíos y retiro" }
                    ]}
                    value={tab}
                    onChange={(value) => setTab(value as TabTienda)}
                />
            </div>
            <div style={{ padding: "var(--space-5)" }}>
                {/* Las tres secciones quedan montadas: cambiar de pestaña no
                    tiene que borrar una integración recién creada ni los
                    cambios sin guardar de MiCorreo. */}
                <div style={{ display: tab === "integraciones" ? "block" : "none" }}>
                    <IntegracionesSection />
                </div>
                <div style={{ display: tab === "mercadopago" ? "block" : "none" }}>
                    <MercadoPagoSection />
                </div>
                <div style={{ display: tab === "envios" ? "block" : "none" }}>
                    <EnviosSection />
                </div>
            </div>
        </Card>
    );
}
