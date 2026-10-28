import { Alert, Button, Icon } from "../../design-system";
import type { ComprobanteResumen } from "../../api/comprobantes";
import { ComprobanteDocumento } from "./ComprobanteDocumento";
import { abrirComprobanteEnPestana } from "./formato";
import { useComprobante } from "./useComprobante";
import "./comprobante.css";

// Preview inline para las fichas. Sólo pide el DTO cuando el comprobante está
// emitido: en pendiente/error no hay documento que renderizar y no se debe
// disparar un fetch de más.
export function ComprobantePreview({ comprobante }: { comprobante: ComprobanteResumen }) {
    const { comprobante: dto, loading, error, refetch } = useComprobante(comprobante.id, {
        enabled: comprobante.estado === "emitida"
    });

    if (comprobante.estado !== "emitida") return null;

    return (
        <div className="comprobante-preview">
            <div className="comprobante-preview-barra">
                <p className="comprobante-preview-titulo">Vista del comprobante</p>
                <Button
                    variant="secondary"
                    size="sm"
                    iconStart="external-link"
                    onClick={() => abrirComprobanteEnPestana(comprobante.id)}
                    aria-label={`Abrir ${comprobante.numeroCompleto ?? "el comprobante"} en una pestaña nueva`}
                >
                    Abrir en pestaña nueva
                </Button>
            </div>

            {loading ? (
                <div className="comprobante-preview-estado" role="status">
                    <Icon
                        name="loader-circle"
                        size={18}
                        style={{ animation: "epublit-spin 900ms linear infinite" }}
                    />
                    Cargando comprobante…
                </div>
            ) : error ? (
                <Alert tone="error" title="No pudimos cargar el comprobante">
                    {error}
                    <div style={{ marginTop: "var(--space-3)" }}>
                        <Button variant="secondary" size="sm" iconStart="arrow-right" onClick={refetch}>
                            Reintentar
                        </Button>
                    </div>
                </Alert>
            ) : dto ? (
                <div
                    className="comprobante-preview-scroll"
                    tabIndex={0}
                    role="region"
                    aria-label={`Vista previa de ${comprobante.numeroCompleto ?? "el comprobante"}`}
                >
                    <ComprobanteDocumento comprobante={dto} />
                </div>
            ) : null}
        </div>
    );
}
