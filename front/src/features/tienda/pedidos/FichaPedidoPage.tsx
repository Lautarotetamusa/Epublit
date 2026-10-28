import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Alert, Badge, Breadcrumb, Button, Card, EmptyState, Icon, Table, Timeline } from "../../../design-system";
import { FullscreenSpinner } from "../../../components/FullscreenSpinner";
import { formatFechaHora } from "../../../lib/fecha";
import { formatMoney } from "../../../lib/money";
import { getErrorMessage } from "../../../lib/errors";
import { descargarBlob } from "../../../lib/descargas";
import { useToast } from "../../../notifications/ToastProvider";
import { descargarEtiqueta } from "../../../api/tienda";
import { provinciaLabel } from "../../../lib/provincias";
import { ComprobantePreview } from "../../comprobantes/ComprobantePreview";
import { ComprobanteResumen } from "../../comprobantes/ComprobanteResumen";
import { usePedido } from "./usePedido";
import { useAccionesPedido } from "./useAccionesPedido";
import { PedidoAcciones } from "./PedidoAcciones";
import { EstadoPagoBadge, EstadoPedidoBadge } from "./PedidoBadges";
import {
    articulosLabel,
    estadoEnvioLabel,
    estadoEnvioTone,
    formaEntregaLabel,
    urlDeSeguimiento
} from "./tipos";
import type { EnvioPedido, EventoSeguimiento, PedidoDetalle } from "./tipos";

const dosColumnas: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "var(--space-6)"
};

const listaDatos: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-4)",
    margin: 0
};

const encabezadoSeccion: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "var(--space-3)",
    minHeight: 22,
    marginBottom: "var(--space-4)"
};

const tituloSeccion: CSSProperties = {
    margin: 0,
    fontFamily: "var(--font-body)",
    fontSize: "var(--text-sm)",
    fontWeight: "var(--weight-semibold)",
    color: "var(--text-body)"
};

export function FichaPedidoPage() {
    const { codigo = "" } = useParams();
    const { pedido, loading, error, refetch } = usePedido(codigo);
    const { showToast } = useToast();
    const { procesando: facturando, facturar } = useAccionesPedido(codigo, refetch);
    const [errorFactura, setErrorFactura] = useState<string | null>(null);
    // El preview guarda el código del pedido al que pertenece: al navegar a
    // otra ficha se cierra solo, sin un efecto de reset.
    const [comprobantePreview, setComprobantePreview] = useState<{
        codigo: string;
        abierto: boolean;
    } | null>(null);
    const navigate = useNavigate();

    if (loading) return <FullscreenSpinner />;

    if (!pedido) {
        return (
            <Card>
                <EmptyState
                    icon="package"
                    title="No pudimos cargar el pedido"
                    description={error ?? "Puede que el enlace esté mal o que el pedido ya no exista."}
                    action={<Button onClick={() => navigate("/pedidos")}>Volver a pedidos</Button>}
                />
            </Card>
        );
    }

    const esCierre = pedido.estado === "entregado" || pedido.estado === "rechazado" || pedido.estado === "cancelado";
    const cantidadItems = pedido.items.reduce((total, item) => total + item.cantidad, 0);
    const itemsTimeline = pedido.historial.map((hito, index) => {
        const esUltimo = index === pedido.historial.length - 1;
        const esError =
            hito.tipo.includes("rechaz") ||
            hito.tipo.includes("cancel") ||
            hito.tipo.includes("reembols") ||
            hito.tipo.includes("pago_rechazado");
        const tone: "done" | "current" | "error" = esError ? "error" : esUltimo && !esCierre ? "current" : "done";

        return {
            id: `${hito.tipo}-${index}`,
            title: hito.descripcion,
            timestamp: formatFechaHora(hito.fecha),
            tone
        };
    });

    const seguimientoFallback =
        pedido.estado === "rechazado" || pedido.estado === "cancelado"
            ? "El pedido no se despachó"
            : pedido.estado === "enviado"
              ? "PAQ.AR todavía no informó el código"
              : pedido.estado === "entregado"
                ? "Sin código informado"
                : "Se asigna al despachar";

    const comprobante = pedido.comprobante;
    const mostrarComprobantePreview =
        comprobantePreview?.codigo === pedido.codigo && comprobantePreview.abierto;
    // Un pedido ya aceptado sin comprobante es una operación anterior al
    // refactor: no se ofrece reintento porque no hay fila que reintentar.
    const operacionSinComprobante =
        comprobante === null &&
        (pedido.estado === "aceptado" || pedido.estado === "enviado" || pedido.estado === "entregado");
    const puedeReintentarFactura =
        comprobante !== null &&
        (comprobante.estado === "pendiente" || comprobante.estado === "error") &&
        (pedido.estado === "aceptado" || pedido.estado === "enviado" || pedido.estado === "entregado");

    const reintentarFactura = async () => {
        setErrorFactura(null);
        try {
            await facturar();
            setComprobantePreview({ codigo: pedido.codigo, abierto: true });
            showToast("success", "Factura emitida correctamente.");
        } catch (err) {
            const mensaje = getErrorMessage(err);
            setErrorFactura(mensaje);
            showToast("error", mensaje);
        }
    };

    const toggleComprobante = () =>
        setComprobantePreview({
            codigo: pedido.codigo,
            abierto: !mostrarComprobantePreview
        });

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Breadcrumb
                items={["Pedidos", pedido.codigo]}
                onNavigate={(_item, index) => index === 0 && navigate("/pedidos")}
            />

            <Card>
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "var(--space-5)" }}>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-3)" }}>
                            <h1
                                style={{
                                    margin: 0,
                                    fontFamily: "var(--font-display)",
                                    fontSize: "var(--text-2xl)",
                                    fontWeight: "var(--weight-semibold)",
                                    letterSpacing: "var(--tracking-tight)"
                                }}
                            >
                                {pedido.codigo}
                            </h1>
                            <EstadoPedidoBadge estado={pedido.estado} />
                            <EstadoPagoBadge estado={pedido.estadoPago} />
                        </div>
                        <p style={{ margin: "var(--space-2) 0 0", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                            {formatFechaHora(pedido.fecha)} · {articulosLabel(cantidadItems)} · {pedido.comprador.nombre}
                        </p>
                    </div>
                    <PedidoAcciones pedido={pedido} onUpdated={refetch} />
                </div>

                <div style={{ marginTop: "var(--space-5)" }}>
                    <AvisoEstado pedido={pedido} />
                </div>
            </Card>

            <Card title="Comprador y entrega" subtitle="Los datos que viajaron en el checkout.">
                <div style={dosColumnas}>
                    <Seccion title="Comprador">
                        <dl style={listaDatos}>
                            <Dato label="Nombre">{pedido.comprador.nombre}</Dato>
                            <Dato label="Email">
                                <a href={`mailto:${pedido.comprador.email}`} style={{ wordBreak: "break-word" }}>
                                    {pedido.comprador.email}
                                </a>
                            </Dato>
                            <Dato label="Teléfono">
                                {pedido.comprador.telefono ? (
                                    <a href={`tel:${pedido.comprador.telefono}`} style={{ wordBreak: "break-word" }}>
                                        {pedido.comprador.telefono}
                                    </a>
                                ) : (
                                    <span style={{ color: "var(--text-muted)" }}>No informado</span>
                                )}
                            </Dato>
                            <Dato label="Documento">{pedido.comprador.documento ?? "No informado"}</Dato>
                        </dl>
                        <p style={{ margin: "var(--space-3) 0 0", fontSize: "var(--text-2xs)", color: "var(--text-subtle)", textWrap: "pretty" }}>
                            Compró como invitado: estos datos viajaron con el pedido y no hay una cuenta de cliente asociada.
                        </p>
                    </Seccion>

                    <Seccion
                        title="Entrega"
                        extra={
                            <Badge
                                tone={pedido.entrega.tipo === "envio" ? "brand" : "accent"}
                                icon={pedido.entrega.tipo === "envio" ? "truck" : "store"}
                            >
                                {formaEntregaLabel(pedido.entrega.tipo)}
                            </Badge>
                        }
                    >
                        <dl style={listaDatos}>
                            {pedido.entrega.tipo === "envio" ? (
                                <>
                                    <Dato label="Dirección">
                                        {formatearDireccion(pedido.entrega.direccion) || "Sin dirección informada"}
                                    </Dato>
                                    <Dato label="Localidad">
                                        {[
                                            pedido.entrega.direccion.localidad,
                                            provinciaLabel(pedido.entrega.direccion.provincia)
                                        ]
                                            .filter(Boolean)
                                            .join(", ") || "Sin localidad informada"}
                                    </Dato>
                                    <Dato label="Código postal" mono>
                                        {pedido.entrega.direccion.codigoPostal ?? "—"}
                                    </Dato>
                                    <Dato label="Costo">
                                        {pedido.entrega.costoEnvio === 0 ? "Sin cargo" : formatMoney(pedido.entrega.costoEnvio)}
                                    </Dato>
                                    {!pedido.envio?.codigoSeguimiento ? (
                                        <Dato label="Seguimiento">
                                            <span style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)" }}>
                                                {seguimientoFallback}
                                            </span>
                                        </Dato>
                                    ) : null}
                                </>
                            ) : (
                                <>
                                    <Dato label="Punto de retiro">{pedido.entrega.punto ?? "—"}</Dato>
                                    <Dato label="Horario">{pedido.entrega.horario ?? "—"}</Dato>
                                    <Dato label="Costo">Sin cargo</Dato>
                                </>
                            )}
                        </dl>
                    </Seccion>
                </div>
                {pedido.entrega.tipo === "envio" && pedido.envio?.codigoSeguimiento ? (
                    <SeguimientoEnvio pedido={pedido} envio={pedido.envio} onUpdated={refetch} />
                ) : null}
            </Card>

            <Card title="Artículos" subtitle={articulosLabel(cantidadItems)} padded={false}>
                <Table
                    columns={[
                        {
                            header: "Título",
                            wrap: true,
                            cell: (row) => (
                                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                    <span style={{ fontWeight: "var(--weight-medium)" }}>{row.titulo}</span>
                                    <span
                                        style={{
                                            fontFamily: "var(--font-mono)",
                                            fontSize: "var(--text-2xs)",
                                            color: "var(--text-subtle)"
                                        }}
                                    >
                                        ISBN {row.isbn}
                                    </span>
                                </div>
                            )
                        },
                        { header: "Cantidad", align: "right", mono: true, key: "cantidad" },
                        {
                            header: "Precio unitario",
                            align: "right",
                            mono: true,
                            cell: (row) => formatMoney(row.precioUnitario)
                        },
                        {
                            header: "Subtotal",
                            align: "right",
                            mono: true,
                            cell: (row) => formatMoney(row.subtotal)
                        }
                    ]}
                    rows={pedido.items}
                />
                <div
                    style={{
                        padding: "var(--space-4) var(--space-5)",
                        borderTop: "1px solid var(--border-subtle)",
                        display: "flex",
                        justifyContent: "flex-end"
                    }}
                >
                    <dl
                        style={{
                            width: "min(100%, 320px)",
                            margin: 0,
                            display: "grid",
                            gridTemplateColumns: "1fr auto",
                            gap: "var(--space-2) var(--space-6)",
                            fontSize: "var(--text-sm)"
                        }}
                    >
                        <dt style={{ color: "var(--text-muted)" }}>Subtotal</dt>
                        <dd style={{ margin: 0, textAlign: "right", fontFamily: "var(--font-mono)" }}>
                            {formatMoney(pedido.subtotal)}
                        </dd>
                        <dt style={{ color: "var(--text-muted)" }}>{pedido.entrega.tipo === "envio" ? "Envío" : "Retiro"}</dt>
                        <dd style={{ margin: 0, textAlign: "right", fontFamily: "var(--font-mono)" }}>
                            {pedido.costoEnvio === 0 ? "Sin cargo" : formatMoney(pedido.costoEnvio)}
                        </dd>
                        <dt
                            style={{
                                color: "var(--text-body)",
                                fontWeight: "var(--weight-semibold)",
                                borderTop: "1px solid var(--border-subtle)",
                                paddingTop: "var(--space-3)"
                            }}
                        >
                            Total
                        </dt>
                        <dd
                            style={{
                                margin: 0,
                                textAlign: "right",
                                fontFamily: "var(--font-display)",
                                fontSize: "var(--text-lg)",
                                fontWeight: "var(--weight-semibold)",
                                borderTop: "1px solid var(--border-subtle)",
                                paddingTop: "var(--space-3)",
                                fontVariantNumeric: "tabular-nums"
                            }}
                        >
                            {formatMoney(pedido.total)}
                        </dd>
                    </dl>
                </div>
            </Card>

            <Card title="Pago y comprobante" subtitle="El cobro de MercadoPago y la factura que genera la aceptación.">
                <div style={dosColumnas}>
                    <Seccion title="Pago" extra={<EstadoPagoBadge estado={pedido.pago.estado} />}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
                            <span
                                style={{
                                    fontFamily: "var(--font-display)",
                                    fontSize: "var(--text-xl)",
                                    fontWeight: "var(--weight-semibold)",
                                    fontVariantNumeric: "tabular-nums"
                                }}
                            >
                                {formatMoney(pedido.pago.importe)}
                            </span>
                            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                                {pedido.pago.proveedor === "mercadopago" ? "MercadoPago" : pedido.pago.proveedor}
                            </span>
                        </div>
                        <dl style={listaDatos}>
                            <Dato label="Medio">MercadoPago Checkout Pro</Dato>
                            <Dato label="Moneda">{pedido.pago.moneda}</Dato>
                            {pedido.pago.idOperacion ? (
                                <Dato label="Operación" mono>
                                    {pedido.pago.idOperacion}
                                </Dato>
                            ) : null}
                            {pedido.pago.fecha ? <Dato label="Fecha">{formatFechaHora(pedido.pago.fecha)}</Dato> : null}
                        </dl>
                        {pedido.estadoPago === "pendiente" ? (
                            <p style={{ margin: "var(--space-4) 0 0", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                                MercadoPago todavía no confirmó el pago.
                            </p>
                        ) : null}
                        {pedido.estadoPago === "reembolsado" ? (
                            <p style={{ margin: "var(--space-4) 0 0", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                                El importe se devolvió al medio de pago.
                            </p>
                        ) : null}
                    </Seccion>

                    <Seccion
                        title="Comprobante"
                        extra={comprobante ? null : <Badge tone="neutral">Sin comprobante</Badge>}
                    >
                        {comprobante ? (
                            <>
                                <ComprobanteResumen comprobante={comprobante} ventaId={pedido.venta?.id} />

                                {comprobante.estado === "pendiente" ? (
                                    <Alert
                                        tone="warning"
                                        title="Factura pendiente de emisión"
                                        style={{ marginTop: "var(--space-4)" }}
                                    >
                                        AFIP todavía no autorizó la factura. La venta ya está registrada.
                                    </Alert>
                                ) : null}

                                {comprobante.estado === "error" ? (
                                    <Alert
                                        tone="error"
                                        title="AFIP no emitió la factura"
                                        style={{ marginTop: "var(--space-4)" }}
                                    >
                                        La venta quedó registrada. Podés reintentar la emisión sin
                                        duplicar el pedido.
                                    </Alert>
                                ) : null}

                                <div
                                    style={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: "var(--space-2)",
                                        marginTop: "var(--space-4)"
                                    }}
                                >
                                    {comprobante.estado === "emitida" ? (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            iconStart="file-text"
                                            aria-expanded={mostrarComprobantePreview}
                                            aria-controls="pedido-comprobante-preview"
                                            onClick={toggleComprobante}
                                        >
                                            {mostrarComprobantePreview
                                                ? "Ocultar comprobante"
                                                : "Ver comprobante"}
                                        </Button>
                                    ) : null}

                                    {puedeReintentarFactura ? (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            iconStart="receipt-text"
                                            onClick={reintentarFactura}
                                            loading={facturando}
                                        >
                                            Reintentar factura
                                        </Button>
                                    ) : null}
                                </div>

                                {errorFactura ? (
                                    <Alert
                                        tone="error"
                                        title="AFIP no emitió la factura"
                                        style={{ marginTop: "var(--space-4)" }}
                                    >
                                        {errorFactura}
                                    </Alert>
                                ) : null}
                            </>
                        ) : (
                            <EmptyState
                                icon="file-text"
                                title={
                                    pedido.estado === "rechazado" || pedido.estado === "cancelado"
                                        ? "No se emitió comprobante"
                                        : operacionSinComprobante
                                          ? "Comprobante no disponible"
                                          : "Todavía no hay comprobante"
                                }
                                description={
                                    pedido.estado === "rechazado" || pedido.estado === "cancelado"
                                        ? "El pedido se cerró antes de la aceptación."
                                        : operacionSinComprobante
                                          ? "La operación es anterior a los comprobantes estructurados y no se puede reimprimir."
                                          : "Se genera automáticamente cuando aceptás el pedido."
                                }
                                style={{
                                    padding: "var(--space-2) 0 0",
                                    alignItems: "flex-start",
                                    textAlign: "left",
                                    gap: "var(--space-2)"
                                }}
                            />
                        )}
                    </Seccion>
                </div>
            </Card>

            {comprobante?.estado === "emitida" && mostrarComprobantePreview ? (
                <Card
                    id="pedido-comprobante-preview"
                    title="Comprobante"
                    subtitle={`${comprobante.tipo?.nombre ?? "Comprobante"} ${comprobante.numeroCompleto ?? ""}`}
                    padded={false}
                >
                    <ComprobantePreview comprobante={comprobante} />
                </Card>
            ) : null}

            <Card
                title="Historial del pedido"
                subtitle="Los hitos del pedido, en orden."
                actions={
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                        Última actualización {formatFechaHora(pedido.actualizadoEn)}
                    </span>
                }
            >
                <Timeline items={itemsTimeline} style={{ maxWidth: "78ch" }} />
            </Card>
        </div>
    );
}

function formatearDireccion(direccion: {
    calle: string | null;
    numero: string | null;
    piso: string | null;
    depto: string | null;
}): string {
    const calleYNumero = [direccion.calle, direccion.numero].filter(Boolean).join(" ");
    const complemento = [direccion.piso, direccion.depto].filter(Boolean).join(" ");
    return [calleYNumero, complemento].filter(Boolean).join(", ");
}

function Seccion({ title, extra, children }: { title: string; extra?: ReactNode; children: ReactNode }) {
    return (
        <section style={{ minWidth: 0 }}>
            <div style={encabezadoSeccion}>
                <h4 style={tituloSeccion}>{title}</h4>
                {extra}
            </div>
            {children}
        </section>
    );
}

// El código de seguimiento es el link principal, tanto en la tarjeta de
// entrega como en el aviso de "Pedido en camino". Un solo componente para que
// el destino y el estilo no se dupliquen.
function CodigoSeguimientoLink({ codigo, url }: { codigo: string; url: string }) {
    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Abrir el seguimiento ${codigo} en Correo Argentino`}
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-1)",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-xs)",
                color: "var(--text-link)",
                textDecoration: "underline",
                textUnderlineOffset: "2px"
            }}
        >
            {codigo}
            <Icon name="external-link" size={12} />
        </a>
    );
}

function BotonSeguimientoCorreo({
    url,
    label = "Ver seguimiento en Correo Argentino",
    variant = "secondary"
}: {
    url: string;
    label?: string;
    variant?: "secondary" | "ghost";
}) {
    return (
        <Button
            variant={variant}
            size="sm"
            iconStart="external-link"
            onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
        >
            {label}
        </Button>
    );
}

// Seguimiento de PAQ.AR dentro de la tarjeta de entrega. Es un bloque
// compacto: el estado y el acceso al correo siempre visibles, y los
// movimientos plegados para no competir con el historial del pedido.
function SeguimientoEnvio({
    pedido,
    envio,
    onUpdated
}: {
    pedido: PedidoDetalle;
    envio: EnvioPedido;
    onUpdated: () => Promise<void> | void;
}) {
    const { showToast } = useToast();
    const { procesando, refrescarEnvio } = useAccionesPedido(pedido.codigo, onUpdated);
    const [abierto, setAbierto] = useState(false);
    const [descargando, setDescargando] = useState(false);
    // El refresh puede devolver un error con el último estado conocido; ese
    // bloque se conserva hasta que el usuario vuelva a refrescar.
    const [envioRefrescado, setEnvioRefrescado] = useState<EnvioPedido | null>(null);
    const actual = envioRefrescado ?? envio;
    const tracking = actual.codigoSeguimiento;

    useEffect(() => {
        setEnvioRefrescado(null);
    }, [pedido.codigo]);

    if (!tracking) return null;

    const url = urlDeSeguimiento(actual);
    const eventos = [...actual.eventos].sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""));

    const reintentar = async () => {
        try {
            const resultado = await refrescarEnvio();
            setEnvioRefrescado(resultado);
            if (resultado.error) {
                showToast("warning", resultado.error);
            } else {
                showToast("success", "Seguimiento actualizado.");
            }
        } catch (err) {
            showToast("error", getErrorMessage(err));
        }
    };

    const bajarEtiqueta = async () => {
        setDescargando(true);
        try {
            const archivo = await descargarEtiqueta(pedido.codigo);
            descargarBlob(archivo.blob, archivo.filename ?? `etiqueta-${pedido.codigo}.pdf`);
        } catch (err) {
            showToast("error", getErrorMessage(err));
        } finally {
            setDescargando(false);
        }
    };

    return (
        <div style={{ marginTop: "var(--space-5)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--border-subtle)" }}>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    alignItems: "start",
                    gap: "var(--space-3)"
                }}
            >
                <dl style={{ margin: 0 }}>
                    <Dato label="Seguimiento del envío">
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-3)" }}>
                            <CodigoSeguimientoLink codigo={tracking} url={url} />
                            {actual.estado ? (
                                <Badge tone={estadoEnvioTone(actual.estado)} dot>
                                    {estadoEnvioLabel(actual.estado)}
                                </Badge>
                            ) : null}
                            {actual.numeroEnvio ? (
                                <span style={{ fontSize: "var(--text-2xs)", color: "var(--text-muted)" }}>
                                    Envío {actual.numeroEnvio}
                                </span>
                            ) : null}
                        </div>
                    </Dato>
                </dl>
                {actual.ultimaActualizacion ? (
                    <span style={{ fontSize: "var(--text-2xs)", color: "var(--text-muted)", textAlign: "right" }}>
                        Última actualización {formatFechaHora(actual.ultimaActualizacion)}
                    </span>
                ) : null}
            </div>

            {actual.error ? (
                <Alert tone="warning" title="No pudimos actualizar el seguimiento" style={{ marginTop: "var(--space-3)" }}>
                    {actual.error}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
                        {actual.etiqueta.disponible ? (
                            <BotonDescargarEtiqueta onClick={bajarEtiqueta} loading={descargando} />
                        ) : null}
                        <Button variant="secondary" size="sm" iconStart="arrow-right" onClick={reintentar} loading={procesando}>
                            Reintentar
                        </Button>
                        <BotonSeguimientoCorreo url={url} label="Ver en Correo Argentino" variant="ghost" />
                    </div>
                </Alert>
            ) : (
                <>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
                        {actual.etiqueta.disponible ? (
                            <BotonDescargarEtiqueta onClick={bajarEtiqueta} loading={descargando} />
                        ) : null}
                        <BotonSeguimientoCorreo url={url} />
                        <Button variant="secondary" size="sm" iconStart="arrow-right" onClick={reintentar} loading={procesando}>
                            Actualizar seguimiento
                        </Button>
                        {eventos.length > 0 ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                iconStart={abierto ? "chevron-down" : "chevron-right"}
                                aria-expanded={abierto}
                                onClick={() => setAbierto((actualAbierto) => !actualAbierto)}
                            >
                                Ver movimientos ({eventos.length})
                            </Button>
                        ) : null}
                    </div>
                    {abierto && eventos.length > 0 ? <ListaEventosEnvio eventos={eventos} /> : null}
                </>
            )}
        </div>
    );
}

function BotonDescargarEtiqueta({ onClick, loading }: { onClick: () => Promise<void> | void; loading: boolean }) {
    return (
        <Button variant="secondary" size="sm" iconStart="download" onClick={onClick} loading={loading}>
            Descargar etiqueta
        </Button>
    );
}

function ListaEventosEnvio({ eventos }: { eventos: EventoSeguimiento[] }) {
    return (
        <ol style={{ listStyle: "none", margin: "var(--space-3) 0 0", padding: 0, display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {eventos.map((evento, index) => (
                <li key={`${evento.estado}-${evento.fecha}-${index}`} style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)" }}>
                    <span
                        style={{
                            width: 6,
                            height: 6,
                            flex: "0 0 auto",
                            marginTop: 6,
                            borderRadius: "var(--radius-pill)",
                            background: index === 0 ? "var(--pino-600)" : "var(--papel-300)"
                        }}
                    />
                    <div>
                        <div
                            style={{
                                fontSize: "var(--text-xs)",
                                fontWeight: index === 0 ? "var(--weight-semibold)" : "var(--weight-medium)"
                            }}
                        >
                            {evento.descripcion || estadoEnvioLabel(evento.estado)}
                        </div>
                        <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-muted)" }}>
                            {evento.fecha ? formatFechaHora(evento.fecha) : "Sin fecha"}
                            {evento.facility ? ` · ${evento.facility}` : ""}
                        </div>
                    </div>
                </li>
            ))}
        </ol>
    );
}

function AvisoEstado({ pedido }: { pedido: PedidoDetalle }) {
    const tracking = pedido.entrega.tipo === "envio" ? pedido.envio?.codigoSeguimiento : null;
    const url = tracking && pedido.envio ? urlDeSeguimiento(pedido.envio) : null;

    switch (pedido.estado) {
        case "pendiente_pago":
            return (
                <Alert tone="warning" title="Esperando el pago">
                    MercadoPago todavía no confirmó el pago. Cuando lo haga, vas a poder aceptar el pedido.
                </Alert>
            );
        case "pagado":
            return (
                <Alert tone="info" title="Pago aprobado">
                    Al aceptar el pedido se genera la venta y la Factura B por {formatMoney(pedido.total)}.
                </Alert>
            );
        case "aceptado": {
            const comprobante = pedido.comprobante;
            const emitida = comprobante?.estado === "emitida";
            const titulo = emitida
                ? "Venta y factura generadas"
                : comprobante
                  ? "Venta generada, factura pendiente"
                  : "Venta generada";
            return (
                <Alert tone="info" title={titulo}>
                    {emitida
                        ? `${comprobante.tipo?.nombre ?? "Factura"} ${comprobante.numeroCompleto ?? ""}. `
                        : comprobante
                          ? "La factura todavía no se emitió; podés reintentarla desde Comprobante. "
                          : "Esta operación no tiene un comprobante estructurado. "}
                    {pedido.entrega.tipo === "envio"
                        ? "Cuando generes la etiqueta en PAQ.AR, el pedido pasa a enviado."
                        : "Cuando el comprador lo retire, marcalo como entregado."}
                </Alert>
            );
        }
        case "enviado":
            if (tracking && url) {
                return (
                    <Alert tone="info" title="Pedido en camino">
                        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                            <span>
                                Despachado con PAQ.AR. Seguimiento <CodigoSeguimientoLink codigo={tracking} url={url} />.
                            </span>
                            <div>
                                <BotonSeguimientoCorreo url={url} />
                            </div>
                        </div>
                    </Alert>
                );
            }
            return (
                <Alert tone="info" title="Pedido en camino">
                    Despachado con PAQ.AR. El seguimiento se completa cuando el correo lo informe.
                </Alert>
            );
        case "entregado":
            if (tracking && url) {
                return (
                    <Alert tone="success" title="Pedido entregado">
                        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                            <span>El pedido se cerró y la venta ya está registrada.</span>
                            <div>
                                <BotonSeguimientoCorreo url={url} />
                            </div>
                        </div>
                    </Alert>
                );
            }
            return (
                <Alert tone="success" title="Pedido entregado">
                    El pedido se cerró y la venta ya está registrada.
                </Alert>
            );
        case "rechazado":
            return (
                <Alert tone="error" title="Pedido rechazado">
                    {pedido.motivoRechazo ?? "El pedido fue rechazado."}
                    {pedido.detalleRechazo ? ` ${pedido.detalleRechazo}` : ""}
                    {pedido.estadoPago === "reembolsado" ? " El pago se reembolsó por MercadoPago." : ""}
                </Alert>
            );
        case "cancelado":
            return (
                <Alert tone="warning" title="Pedido cancelado">
                    El pago no se completó y el pedido se cerró sin cobro.
                </Alert>
            );
    }
}

function Dato({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
    return (
        <div>
            <dt
                style={{
                    fontSize: "var(--text-2xs)",
                    textTransform: "uppercase",
                    letterSpacing: "var(--tracking-caps)",
                    color: "var(--text-muted)"
                }}
            >
                {label}
            </dt>
            <dd
                style={{
                    margin: "4px 0 0",
                    fontFamily: mono ? "var(--font-mono)" : undefined,
                    fontSize: mono ? "var(--text-xs)" : undefined,
                    wordBreak: "break-word"
                }}
            >
                {children}
            </dd>
        </div>
    );
}
