import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Dialog, SegmentedControl } from "../../design-system";
import { useMediaQuery } from "../../lib/useMediaQuery";
import { PaginaPreview } from "./PaginaPreview";
import { useMenuContenido } from "./useMenuContenido";
import type { PaginaContenido } from "./tipos";

type Dispositivo = "escritorio" | "movil";

export function PrevisualizacionPagina({
    pagina,
    open,
    onClose
}: {
    pagina: PaginaContenido;
    open: boolean;
    onClose: () => void;
}) {
    const [dispositivo, setDispositivo] = useState<Dispositivo>("escritorio");
    // En un teléfono el diálogo no tiene ancho para mostrar "escritorio": la
    // vista útil es la móvil, y el selector sobra.
    const esAngosto = useMediaQuery("(max-width: 720px)");
    const dispositivoActual: Dispositivo = esAngosto ? "movil" : dispositivo;

    // El Dialog del sistema no atrapa Escape por su cuenta; un diálogo de
    // previsualización tiene que poder cerrarse con el teclado.
    useEffect(() => {
        if (!open) return;
        const cerrar = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", cerrar);
        return () => window.removeEventListener("keydown", cerrar);
    }, [open, onClose]);

    // El menú de la previsualización sale de las páginas publicadas visibles.
    // La página actual se reemplaza por la versión en edición, para que un
    // cambio de título, visibilidad u orden se vea antes de guardar.
    const paginasPublicadas = useMenuContenido();
    const menu = useMemo(() => {
        const otras = paginasPublicadas.filter((item) => item.id !== pagina.id);
        return [...otras, pagina]
            .filter((item) => item.visibleEnMenu && (item.estado === "publicada" || item.id === pagina.id))
            .sort((a, b) => a.orden - b.orden || a.titulo.localeCompare(b.titulo));
    }, [paginasPublicadas, pagina]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            width={1120}
            title="Previsualización"
            description={`${pagina.titulo.trim() || "Página sin título"} · ${pagina.estado === "publicada" ? "Publicada" : "Borrador"}`}
            footer={
                <>
                    <span style={{ marginRight: "auto", fontSize: "var(--text-xs)", color: "var(--text-muted)", textAlign: "left" }}>
                        Los cambios sin guardar se ven acá; la landing los recibe cuando guardes.
                    </span>
                    <Button variant="secondary" onClick={onClose}>
                        Cerrar
                    </Button>
                </>
            }
        >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", flexWrap: "wrap", marginBottom: "var(--space-2)" }}>
                {esAngosto ? (
                    <Badge tone="neutral">Vista móvil</Badge>
                ) : (
                    <SegmentedControl
                        style={{ width: 300, maxWidth: "100%" }}
                        options={[
                            { value: "escritorio", label: "Escritorio" },
                            { value: "movil", label: "Móvil" }
                        ]}
                        value={dispositivo}
                        onChange={(valor) => setDispositivo(valor as Dispositivo)}
                    />
                )}
                <Button
                    size="sm"
                    variant="secondary"
                    iconStart="external-link"
                    disabled
                    title="Se habilita cuando la landing esté conectada"
                >
                    Abrir en la landing
                </Button>
            </div>
            <p style={{ margin: "0 0 var(--space-3)", fontSize: "var(--text-2xs)", color: "var(--text-muted)" }}>
                La conexión con el sitio se habilita en la próxima fase. Por ahora esta vista es la referencia de cómo se arma la página.
            </p>

            <div
                style={{
                    background: "var(--papel-100)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-md)",
                    padding: dispositivoActual === "movil" ? "var(--space-4)" : "var(--space-3)",
                    display: "flex",
                    justifyContent: "center"
                }}
            >
                <div
                    role="region"
                    aria-label={`Previsualización de ${pagina.titulo || "la página"}`}
                    style={{
                        width: dispositivoActual === "movil" ? 390 : "100%",
                        maxWidth: "100%",
                        height: "min(600px, 58vh)",
                        overflowY: "auto",
                        overflowX: "hidden",
                        background: "var(--papel-50)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-sm)",
                        boxShadow: "var(--shadow-sm)"
                    }}
                >
                    <PaginaPreview pagina={pagina} menu={menu} movil={dispositivoActual === "movil"} />
                </div>
            </div>
        </Dialog>
    );
}
