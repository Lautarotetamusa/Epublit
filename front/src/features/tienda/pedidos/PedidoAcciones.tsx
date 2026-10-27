import { useState } from "react";
import { Alert, Button, Dialog, Field, Select, Textarea } from "../../../design-system";
import { useConfirm } from "../../../notifications/ConfirmProvider";
import { useToast } from "../../../notifications/ToastProvider";
import { ApiError } from "../../../api/client";
import type { RechazarPedidoInput } from "../../../api/tienda";
import { getErrorMessage } from "../../../lib/errors";
import { formatMoney } from "../../../lib/money";
import type { PedidoDetalle } from "./tipos";
import { accionesDisponibles } from "./tipos";
import { useAccionesPedido } from "./useAccionesPedido";

type DialogoAbierto = "rechazar" | null;

type ErrorEtiqueta = {
    codigo: string | null;
    mensaje: string;
};

const MOTIVOS_RECHAZO = [
    { value: "sin_stock", label: "Sin stock" },
    { value: "sin_contacto", label: "No pudimos contactar al comprador" },
    { value: "fuera_zona", label: "Dirección fuera de la zona de entrega" },
    { value: "datos_incompletos", label: "Datos del comprador incompletos" },
    { value: "otro", label: "Otro motivo" }
];

function errorDeEtiqueta(err: unknown): ErrorEtiqueta {
    if (err instanceof ApiError) {
        return {
            codigo: err.errors[0]?.code ?? null,
            mensaje: getErrorMessage(err)
        };
    }
    return { codigo: null, mensaje: getErrorMessage(err) };
}

// Acciones del pedido en la ficha. Las habilitaciones salen de
// `accionesDisponibles` (tipos.ts): aceptar sólo después del pago, despachar
// sólo un envío aceptado (generando la etiqueta en PAQ.AR), entregar un
// envío despachado o un retiro aceptado. Las que tienen consecuencia
// registral piden confirmación.
export function PedidoAcciones({ pedido, onUpdated }: { pedido: PedidoDetalle; onUpdated: () => Promise<void> | void }) {
    const acciones = accionesDisponibles(pedido);
    const { showToast } = useToast();
    const confirm = useConfirm();
    const [dialogo, setDialogo] = useState<DialogoAbierto>(null);
    const [errorEtiqueta, setErrorEtiqueta] = useState<ErrorEtiqueta | null>(null);
    const { procesando, aceptar, rechazar, despachar, entregar } = useAccionesPedido(pedido.codigo, onUpdated);

    const handleAceptar = async () => {
        const ok = await confirm({
            title: `¿Aceptar el pedido ${pedido.codigo}?`,
            description: `Se genera la venta y la Factura B por ${formatMoney(pedido.total)}. El stock reservado pasa a la venta y el comprobante aparece en la ficha.`,
            confirmLabel: "Aceptar y generar factura"
        });
        if (!ok) return;

        try {
            await aceptar();
            showToast("success", "Pedido aceptado. La venta quedó registrada.");
        } catch (err) {
            showToast("error", getErrorMessage(err));
        }
    };

    // La etiqueta la crea PAQ.AR: el pedido no se marca enviado hasta que
    // exista el envío y el PDF. Si falla, queda aceptado y se puede reintentar
    // sin generar una etiqueta duplicada.
    const handleDespachar = async () => {
        try {
            await despachar();
            setErrorEtiqueta(null);
            showToast("success", "Etiqueta generada. El pedido pasó a enviado.");
        } catch (err) {
            setErrorEtiqueta(errorDeEtiqueta(err));
        }
    };

    const generarEtiqueta = async () => {
        const ok = await confirm({
            title: "¿Generar la etiqueta y despachar?",
            description:
                "Se crea el envío en PAQ.AR, se genera el PDF de la etiqueta y el pedido pasa a enviado. Si falla, el pedido sigue aceptado.",
            confirmLabel: "Generar etiqueta y despachar"
        });
        if (!ok) return;
        await handleDespachar();
    };

    const handleEntregar = async () => {
        const esRetiro = pedido.entrega.tipo === "retiro";
        const ok = await confirm({
            title: "¿Marcar el pedido como entregado?",
            description: esRetiro
                ? "Confirmá que el comprador retiró el pedido en el local. El pedido queda cerrado."
                : "Confirmá que el comprador recibió el pedido. El pedido queda cerrado.",
            confirmLabel: "Marcar como entregado"
        });
        if (!ok) return;

        try {
            await entregar();
            showToast("success", "Pedido marcado como entregado.");
        } catch (err) {
            showToast("error", getErrorMessage(err));
        }
    };

    const handleRechazar = async (input: RechazarPedidoInput) => {
        await rechazar(input);
        showToast("success", "Pedido rechazado.");
    };

    const hayAcciones = acciones.aceptar || acciones.rechazar || acciones.enviar || acciones.entregar;
    if (!hayAcciones) return null;

    return (
        <>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: "var(--space-2)" }}>
                {acciones.rechazar ? (
                    <Button variant="secondary" iconStart="x" onClick={() => setDialogo("rechazar")} disabled={procesando}>
                        Rechazar pedido
                    </Button>
                ) : null}
                {acciones.aceptar ? (
                    <Button iconStart="check" onClick={handleAceptar} loading={procesando}>
                        Aceptar pedido
                    </Button>
                ) : null}
                {acciones.enviar ? (
                    <Button iconStart="printer" onClick={generarEtiqueta} loading={procesando}>
                        Generar etiqueta y despachar
                    </Button>
                ) : null}
                {acciones.entregar ? (
                    <Button iconStart="package" onClick={handleEntregar} loading={procesando}>
                        Marcar como entregado
                    </Button>
                ) : null}
            </div>

            {dialogo === "rechazar" ? (
                <RechazarPedidoDialog
                    pedido={pedido}
                    saving={procesando}
                    onClose={() => setDialogo(null)}
                    onRechazar={handleRechazar}
                    onDone={() => setDialogo(null)}
                />
            ) : null}

            {errorEtiqueta ? (
                <Dialog
                    open
                    title="No se pudo generar la etiqueta"
                    description="El pedido sigue aceptado y no se marcó como enviado."
                    onClose={() => setErrorEtiqueta(null)}
                    footer={
                        <>
                            <Button variant="secondary" onClick={() => setErrorEtiqueta(null)}>
                                Cerrar
                            </Button>
                            <Button iconStart="arrow-right" onClick={handleDespachar} loading={procesando}>
                                Reintentar
                            </Button>
                        </>
                    }
                >
                    {errorEtiqueta.codigo ? (
                        <p style={{ margin: "0 0 var(--space-3)", fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--text-subtle)" }}>
                            {errorEtiqueta.codigo}
                        </p>
                    ) : null}
                    <Alert tone="error">{errorEtiqueta.mensaje}</Alert>
                    <p style={{ margin: "var(--space-4) 0 0", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                        Podés reintentar sin duplicar la etiqueta. Si el problema sigue, revisá la configuración de PAQ.AR en Configuración.
                    </p>
                </Dialog>
            ) : null}
        </>
    );
}

function RechazarPedidoDialog({
    pedido,
    saving,
    onClose,
    onRechazar,
    onDone
}: {
    pedido: PedidoDetalle;
    saving: boolean;
    onClose: () => void;
    onRechazar: (input: RechazarPedidoInput) => Promise<void>;
    onDone: () => void;
}) {
    const { showToast } = useToast();
    const [motivo, setMotivo] = useState("");
    const [detalle, setDetalle] = useState("");

    const exigeDetalle = motivo === "otro";
    const detalleInvalido = exigeDetalle && detalle.trim() === "";
    const etiquetaMotivo = MOTIVOS_RECHAZO.find((opcion) => opcion.value === motivo)?.label ?? "";
    const puedeRechazar = motivo !== "" && !detalleInvalido;

    const handleRechazar = async () => {
        try {
            await onRechazar({
                motivo: etiquetaMotivo,
                detalle: detalle.trim() || undefined
            });
            onDone();
        } catch (err) {
            // Un 502 de MercadoPago deja el pedido como estaba; no se cierra
            // el diálogo para poder reintentar o cambiar el motivo.
            showToast("error", getErrorMessage(err));
        }
    };

    return (
        <Dialog
            open
            title="Rechazar pedido"
            description="El comprador recibe el motivo y el pedido deja de estar pendiente."
            onClose={onClose}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button variant="danger" onClick={handleRechazar} loading={saving} disabled={!puedeRechazar}>
                        Rechazar pedido
                    </Button>
                </>
            }
        >
            {pedido.estadoPago === "aprobado" ? (
                <Alert tone="warning" title="El pago ya está aprobado" style={{ marginBottom: "var(--space-4)" }}>
                    Al rechazar el pedido se registra el reembolso del pago en MercadoPago.
                </Alert>
            ) : null}
            <Field label="Motivo" required>
                <Select value={motivo} onChange={(e) => setMotivo(e.target.value)} options={MOTIVOS_RECHAZO} placeholder="Elegí un motivo" />
            </Field>
            <Field
                label={exigeDetalle ? "Detalle" : "Detalle (opcional)"}
                required={exigeDetalle}
                error={detalleInvalido ? "Contá el motivo del rechazo." : undefined}
                hint="Queda en el historial del pedido."
                style={{ marginTop: "var(--space-4)" }}
            >
                <Textarea rows={3} value={detalle} onChange={(e) => setDetalle(e.target.value)} invalid={detalleInvalido} />
            </Field>
        </Dialog>
    );
}
