import { useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Alert, Button, Card, EmptyState } from "../../design-system";
import { FullscreenSpinner } from "../../components/FullscreenSpinner";
import { useToast } from "../../notifications/ToastProvider";
import { ComprobanteDocumento } from "./ComprobanteDocumento";
import { EstadoComprobanteBadge } from "./ComprobanteResumen";
import { nombreComprobante } from "./formato";
import { useComprobante, useReintentarComprobante } from "./useComprobante";
import { useImprimirComprobante } from "./useImprimirComprobante";
import "./comprobante.css";

// Ruta canónica del comprobante. Vive fuera de `AppLayout` porque es una
// vista de lectura/impresión A4, no una pantalla de gestión.
export function ComprobantePage() {
    const { id = "" } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { showToast } = useToast();

    const numeroId = Number(id);
    const idValido = Number.isInteger(numeroId) && numeroId > 0;
    const comprobanteId = idValido ? numeroId : null;

    const { comprobante, loading, error, refetch } = useComprobante(comprobanteId);
    const { reintentar, reintentando, error: errorReintento } = useReintentarComprobante(
        comprobanteId,
        refetch
    );

    const autoImprimir = new URLSearchParams(location.search).get("print") === "1";
    const qrFaltante =
        comprobante?.clase === "factura" &&
        comprobante.estado === "emitida" &&
        !comprobante.qr?.dataUrl;
    const listoParaImprimir = comprobante?.estado === "emitida" && !qrFaltante;

    const { imprimir } = useImprimirComprobante({
        auto: autoImprimir,
        listoParaImprimir
    });

    useEffect(() => {
        const anterior = document.documentElement.lang;
        document.documentElement.lang = "es-AR";
        return () => {
            document.documentElement.lang = anterior;
        };
    }, []);

    useEffect(() => {
        if (!comprobante) return;

        const anterior = document.title;
        document.title = `${nombreComprobante(comprobante)} ${comprobante.numeroCompleto ?? ""}`.trim();
        return () => {
            document.title = anterior;
        };
    }, [comprobante]);

    const volver = () => {
        // En una pestaña abierta con la URL directa no hay historia a la que
        // volver: se cae al inicio en vez de dejar la vista sin salida.
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate("/");
        }
    };

    const reintentarEmision = async () => {
        const actualizado = await reintentar();
        if (actualizado) {
            showToast("success", "Factura emitida correctamente.");
        }
    };

    if (loading) {
        return (
            <div className="comprobante-page">
                <FullscreenSpinner />
            </div>
        );
    }

    if (!comprobante) {
        return (
            <div className="comprobante-page">
                <main lang="es-AR" className="comprobante-page-content">
                    <Card>
                        <EmptyState
                            icon="file-text"
                            title="No pudimos cargar el comprobante"
                            description={
                                idValido
                                    ? error ?? "Puede que el enlace esté mal o que el comprobante ya no exista."
                                    : "El identificador del comprobante no es válido."
                            }
                            action={
                                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                                    <Button onClick={volver}>Volver</Button>
                                    {idValido ? (
                                        <Button variant="secondary" iconStart="arrow-right" onClick={refetch}>
                                            Reintentar
                                        </Button>
                                    ) : null}
                                </div>
                            }
                        />
                    </Card>
                </main>
            </div>
        );
    }

    const titulo = `${nombreComprobante(comprobante)} ${comprobante.numeroCompleto ?? ""}`.trim();
    const esFactura = comprobante.clase === "factura";

    return (
        <div className="comprobante-page">
            <header className="comprobante-toolbar">
                <div className="comprobante-toolbar-izq">
                    <Button
                        variant="ghost"
                        size="sm"
                        iconStart="chevron-left"
                        onClick={volver}
                    >
                        Volver
                    </Button>
                    <div>
                        <p className="eyebrow">Comprobante</p>
                        <h1 className="comprobante-toolbar-titulo">{titulo}</h1>
                    </div>
                </div>

                <div className="comprobante-toolbar-acciones">
                    <EstadoComprobanteBadge estado={comprobante.estado} />
                    {comprobante.estado === "emitida" ? (
                        <Button
                            iconStart="printer"
                            onClick={() => void imprimir()}
                            disabled={qrFaltante}
                            aria-label="Imprimir o guardar como PDF"
                        >
                            Imprimir / Guardar PDF
                        </Button>
                    ) : null}
                </div>
            </header>

            <main lang="es-AR" className="comprobante-page-content">
                {comprobante.estado === "pendiente" ? (
                    <Card
                        title={
                            esFactura ? "Factura pendiente de emisión" : "Comprobante pendiente de emisión"
                        }
                    >
                        <div className="comprobante-estado-emision">
                            <Alert
                                tone="warning"
                                title={
                                    esFactura
                                        ? "AFIP todavía no autorizó el comprobante"
                                        : "El comprobante todavía no está disponible"
                                }
                            >
                                {esFactura
                                    ? "La factura se generó al registrar la operación, pero AFIP todavía no respondió. Podés reintentar la emisión."
                                    : "El comprobante se está generando. Volvé a intentarlo en unos instantes."}
                            </Alert>

                            {esFactura ? (
                                <div className="comprobante-estado-acciones">
                                    <Button
                                        variant="secondary"
                                        iconStart="receipt-text"
                                        onClick={reintentarEmision}
                                        loading={reintentando}
                                    >
                                        Reintentar emisión
                                    </Button>
                                </div>
                            ) : null}

                            {errorReintento ? (
                                <Alert tone="error" title="No se pudo reintentar la emisión">
                                    {errorReintento}
                                </Alert>
                            ) : null}
                        </div>
                    </Card>
                ) : comprobante.estado === "error" ? (
                    <Card title={esFactura ? "Error de emisión" : "Comprobante no disponible"}>
                        <div className="comprobante-estado-emision">
                            <Alert
                                tone="error"
                                title={esFactura ? "AFIP no emitió la factura" : "No se pudo emitir el comprobante"}
                            >
                                {comprobante.error?.mensaje ??
                                    "La emisión no se pudo completar. La venta quedó registrada y podés reintentar."}
                                {comprobante.error?.codigo ? ` (código ${comprobante.error.codigo})` : ""}
                            </Alert>

                            {esFactura ? (
                                <div className="comprobante-estado-acciones">
                                    <Button
                                        variant="secondary"
                                        iconStart="receipt-text"
                                        onClick={reintentarEmision}
                                        loading={reintentando}
                                    >
                                        Reintentar emisión
                                    </Button>
                                </div>
                            ) : null}

                            {errorReintento ? (
                                <Alert tone="error" title="No se pudo reintentar la emisión">
                                    {errorReintento}
                                </Alert>
                            ) : null}
                        </div>
                    </Card>
                ) : (
                    <>
                        {qrFaltante ? (
                            <Alert tone="error" title="Falta el código QR">
                                El comprobante está emitido, pero el backend no pudo generar el QR.
                                No se puede imprimir hasta regenerarlo.
                            </Alert>
                        ) : null}
                        <ComprobanteDocumento comprobante={comprobante} />
                    </>
                )}
            </main>
        </div>
    );
}
