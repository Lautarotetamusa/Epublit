import { useRef, useState } from "react";
import type { ChangeEvent, ComponentProps } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Badge, Button, Card, Dialog, Field, Input } from "../../design-system";
import type { EstadoCertificado, EstadoFacturacion } from "../../api/user";
import { formatFecha } from "../../lib/fecha";
import { sanitizeInteger } from "../../lib/numericInput";
import { Detalle } from "./Detalle";

type FacturacionElectronicaCardProps = {
    estado: EstadoFacturacion;
    onDescargarCSR: () => Promise<void>;
    onSubirCertificado: (file: File) => Promise<void>;
    onGuardarPuntoVenta: (puntoVenta: number) => Promise<void>;
};

const CERTIFICADO: Record<EstadoCertificado, { texto: string; tone: NonNullable<ComponentProps<typeof Badge>["tone"]> }> = {
    faltante: { texto: "Sin cargar", tone: "neutral" },
    no_corresponde: { texto: "No corresponde a tu cuenta", tone: "error" },
    vencido: { texto: "Vencido", tone: "error" },
    por_vencer: { texto: "Por vencer", tone: "warning" },
    vigente: { texto: "Vigente", tone: "success" }
};

export function FacturacionElectronicaCard({
    estado,
    onDescargarCSR,
    onSubirCertificado,
    onGuardarPuntoVenta
}: FacturacionElectronicaCardProps) {
    const navigate = useNavigate();
    const inputCertificado = useRef<HTMLInputElement>(null);
    const [descargando, setDescargando] = useState(false);
    const [subiendo, setSubiendo] = useState(false);
    const [editandoPuntoVenta, setEditandoPuntoVenta] = useState(false);

    const certificado = CERTIFICADO[estado.certificado.estado];
    const faltaCertificado = estado.certificado.estado !== "vigente" && estado.certificado.estado !== "por_vencer";

    const handleDescargar = async () => {
        setDescargando(true);
        await onDescargarCSR();
        setDescargando(false);
    };

    const handleArchivo = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        // Se limpia para que elegir el mismo archivo otra vez (después de un
        // error) vuelva a disparar el `change`.
        event.target.value = "";
        if (!file) return;

        setSubiendo(true);
        await onSubirCertificado(file);
        setSubiendo(false);
    };

    return (
        <Card
            title="Facturación electrónica"
            subtitle="Certificado de ARCA y punto de venta para emitir facturas."
            actions={
                <Button variant="ghost" size="sm" iconStart="circle-help" onClick={() => navigate("/ayuda/certificado-arca")}>
                    ¿Cómo genero el certificado?
                </Button>
            }
        >
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
                <EstadoGeneral estado={estado} />

                <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-4)", margin: 0 }}>
                    <Detalle
                        label="Certificado"
                        value={
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                                <Badge tone={certificado.tone}>{certificado.texto}</Badge>
                                {estado.certificado.vence ? (
                                    <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                                        vence el {formatFecha(estado.certificado.vence)}
                                    </span>
                                ) : null}
                            </span>
                        }
                    />
                    <Detalle
                        label="Punto de venta"
                        value={
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
                                {estado.punto_venta !== null ? <Badge tone="brand">{estado.punto_venta}</Badge> : "Sin cargar"}
                                <Button variant="ghost" size="sm" iconStart="pencil" onClick={() => setEditandoPuntoVenta(true)}>
                                    {estado.punto_venta !== null ? "Cambiar" : "Cargar"}
                                </Button>
                            </span>
                        }
                    />
                    <Detalle
                        label="Entorno"
                        value={
                            estado.entorno === "produccion" ? (
                                <Badge tone="success">Producción</Badge>
                            ) : (
                                <Badge tone="neutral">Prueba (homologación)</Badge>
                            )
                        }
                    />
                </dl>

                <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
                    <Button variant="secondary" iconStart="download" onClick={handleDescargar} loading={descargando}>
                        Descargar CSR
                    </Button>
                    <Button
                        variant={faltaCertificado ? "primary" : "secondary"}
                        iconStart="upload"
                        onClick={() => inputCertificado.current?.click()}
                        loading={subiendo}
                    >
                        {faltaCertificado ? "Subir certificado" : "Reemplazar certificado"}
                    </Button>
                    <input
                        ref={inputCertificado}
                        type="file"
                        accept=".crt,.pem,.cer"
                        onChange={handleArchivo}
                        hidden
                    />
                </div>
            </div>

            {editandoPuntoVenta ? (
                <EditarPuntoVentaDialog
                    actual={estado.punto_venta}
                    onClose={() => setEditandoPuntoVenta(false)}
                    onSave={async (puntoVenta) => {
                        await onGuardarPuntoVenta(puntoVenta);
                        setEditandoPuntoVenta(false);
                    }}
                />
            ) : null}
        </Card>
    );
}

function EstadoGeneral({ estado }: { estado: EstadoFacturacion }) {
    if (!estado.habilitado) {
        return (
            <Alert tone="warning" title="Todavía no podés emitir facturas">
                <ul style={{ margin: "var(--space-2) 0 0", paddingLeft: "1.2em" }}>
                    {estado.pendientes.map((pendiente) => (
                        <li key={pendiente.codigo}>{pendiente.mensaje}</li>
                    ))}
                </ul>
            </Alert>
        );
    }

    if (estado.certificado.estado === "por_vencer" && estado.certificado.vence) {
        return (
            <Alert tone="warning" title="Tu cuenta está lista para facturar">
                El certificado de ARCA vence el {formatFecha(estado.certificado.vence)}. Generá uno nuevo antes de esa fecha para no
                cortar la facturación.
            </Alert>
        );
    }

    return (
        <Alert tone="success" title="Tu cuenta está lista para facturar">
            Las ventas a clientes con factura se emiten en ARCA con tu certificado y tu punto de venta.
        </Alert>
    );
}

function EditarPuntoVentaDialog({
    actual,
    onClose,
    onSave
}: {
    actual: number | null;
    onClose: () => void;
    onSave: (puntoVenta: number) => Promise<void>;
}) {
    const [puntoVenta, setPuntoVenta] = useState(actual === null ? "" : String(actual));
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        await onSave(Number(puntoVenta));
        setSaving(false);
    };

    return (
        <Dialog
            open
            title="Punto de venta"
            onClose={onClose}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} loading={saving} disabled={puntoVenta === ""}>
                        Guardar
                    </Button>
                </>
            }
        >
            <Field label="Número de punto de venta" hint="El que diste de alta en ARCA como Web Service." required>
                <Input type="text" inputMode="numeric" value={puntoVenta} onChange={(e) => setPuntoVenta(sanitizeInteger(e.target.value))} />
            </Field>
        </Dialog>
    );
}
