import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge, Breadcrumb, Button, Card, EmptyState, IconButton, ProgressBar, StatCard, Table } from "../../design-system";
import type { Pago, PersonaAPagar, RegistrarPagoInput } from "../../api/liquidaciones";
import { FullscreenSpinner } from "../../components/FullscreenSpinner";
import { useConfirm } from "../../notifications/ConfirmProvider";
import { useToast } from "../../notifications/ToastProvider";
import { getErrorMessage } from "../../lib/errors";
import { formatFecha, formatRango } from "../../lib/fecha";
import { nombreVisible, tonoDeRol } from "../roles/presentacionRol";
import { useFichaLiquidacion } from "./useFichaLiquidacion";
import { DetallePersonaDialog } from "./DetallePersonaDialog";
import { RegistrarPagoDialog } from "./RegistrarPagoDialog";
import { formatMoney } from "../../lib/money";
import { etiquetaEstado, porcentajePagado, tonoEstado } from "./presentacionLiquidacion";

// La ficha de una liquidación ya generada: cuánto es, cuánto se pagó y cuánto
// falta, por persona y en total, con el historial de pagos parciales. El pago se
// registra desde acá (fila o encabezado), nunca desde el listado.
export function FichaLiquidacionPage() {
    const { id = "" } = useParams();
    const { liquidacion, loading, pagar, anular } = useFichaLiquidacion(Number(id));
    const { showToast } = useToast();
    const confirm = useConfirm();
    const navigate = useNavigate();

    const [personaDetalle, setPersonaDetalle] = useState<PersonaAPagar | null>(null);
    // `undefined` = diálogo cerrado; `null` = abierto sin persona elegida; un id = abierto en esa persona.
    const [pagarA, setPagarA] = useState<number | null | undefined>(undefined);

    if (loading) return <FullscreenSpinner />;

    if (!liquidacion) {
        return (
            <Card>
                <EmptyState
                    icon="percent"
                    title="La liquidación no existe"
                    description="Puede que el enlace esté mal."
                    action={<Button onClick={() => navigate("/liquidaciones")}>Volver a liquidaciones</Button>}
                />
            </Card>
        );
    }

    const conSaldo = liquidacion.personas.filter((p) => p.saldo > 0);
    // La persona fresca: si se registra un pago con el detalle abierto, el
    // desglose y el progreso siguen reflejando el estado real y no el del
    // momento del clic.
    const personaDetalleActual = personaDetalle
        ? liquidacion.personas.find((p) => p.id_persona === personaDetalle.id_persona) ?? personaDetalle
        : null;
    const pagos = liquidacion.personas
        .flatMap((persona) => persona.pagos.map((pago) => ({ pago, persona })))
        .sort((a, b) => (a.pago.fecha < b.pago.fecha ? 1 : -1));

    const confirmarPago = async (idPersona: number, input: RegistrarPagoInput): Promise<boolean> => {
        try {
            await pagar(idPersona, input);
            showToast("success", "Pago registrado correctamente");
            return true;
        } catch (err) {
            showToast("error", getErrorMessage(err));
            return false;
        }
    };

    const anularPagoRegistrado = async (pago: Pago, persona: PersonaAPagar) => {
        const ok = await confirm({
            title: `¿Anular el pago de ${formatMoney(pago.monto)} a ${persona.nombre}?`,
            description: "El saldo de esa persona vuelve a quedar pendiente.",
            confirmLabel: "Anular pago",
            tone: "danger"
        });
        if (!ok) return;

        try {
            await anular(pago.id);
            showToast("success", "Pago anulado");
        } catch (err) {
            showToast("error", getErrorMessage(err));
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Breadcrumb items={["Liquidaciones", liquidacion.codigo]} onNavigate={(_item, index) => index === 0 && navigate("/liquidaciones")} />

            <Card
                title={liquidacion.codigo}
                subtitle={`Del ${formatRango(liquidacion.desde, liquidacion.hasta)} · Generada el ${formatFecha(liquidacion.fecha_generacion)}`}
                actions={
                    <>
                        <Badge tone={tonoEstado(liquidacion.estado)} dot={liquidacion.estado === "pagada"}>
                            {etiquetaEstado(liquidacion.estado)}
                        </Badge>
                        <Button variant="secondary" size="sm" iconStart="printer" onClick={() => window.print()}>
                            Imprimir
                        </Button>
                    </>
                }
            >
                <div style={{ maxWidth: 520 }}>
                    <ProgressBar
                        value={porcentajePagado(liquidacion.total, liquidacion.pagado)}
                        label="Pagado"
                        tone={liquidacion.estado === "pagada" ? "success" : "brand"}
                    />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-4)", marginTop: "var(--space-5)" }}>
                    <StatCard label="Total" value={formatMoney(liquidacion.total)} icon="receipt-text" />
                    <StatCard label="Pagado" value={formatMoney(liquidacion.pagado)} icon="circle-check" />
                    <StatCard label="Saldo" value={formatMoney(liquidacion.saldo)} icon="banknote" />
                </div>
            </Card>

            <Card
                title="A pagar por persona"
                padded={false}
                actions={
                    conSaldo.length > 0 ? (
                        <Button size="sm" iconStart="banknote" onClick={() => setPagarA(null)}>
                            Registrar pago
                        </Button>
                    ) : undefined
                }
            >
                <Table
                    columns={[
                        { header: "Persona", key: "nombre", wrap: true },
                        {
                            header: "Rol",
                            cell: (p: PersonaAPagar) => (
                                <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap" }}>
                                    {p.roles.map((rol) => (
                                        <Badge key={rol.id} tone={tonoDeRol(rol)}>
                                            {nombreVisible(rol.nombre)}
                                        </Badge>
                                    ))}
                                </div>
                            )
                        },
                        { header: "Total", align: "right", mono: true, cell: (p: PersonaAPagar) => formatMoney(p.total) },
                        { header: "Pagado", align: "right", mono: true, cell: (p: PersonaAPagar) => formatMoney(p.pagado) },
                        {
                            header: "Saldo",
                            align: "right",
                            mono: true,
                            cell: (p: PersonaAPagar) => (
                                <b style={{ color: p.saldo > 0 ? "var(--text-body)" : "var(--text-subtle)" }}>{formatMoney(p.saldo)}</b>
                            )
                        },
                        {
                            header: "Estado",
                            cell: (p: PersonaAPagar) => (
                                <Badge tone={tonoEstado(p.estado)} dot={p.estado === "pagada"}>
                                    {etiquetaEstado(p.estado)}
                                </Badge>
                            )
                        },
                        {
                            header: "",
                            width: 96,
                            align: "right",
                            cell: (p: PersonaAPagar) => (
                                <div style={{ display: "flex", gap: "var(--space-1)", justifyContent: "flex-end" }}>
                                    {p.saldo > 0 ? (
                                        <IconButton
                                            icon="banknote"
                                            label={`Registrar pago a ${p.nombre}`}
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPagarA(p.id_persona);
                                            }}
                                        />
                                    ) : null}
                                    <IconButton
                                        icon="file-text"
                                        label={`Ver detalle de ${p.nombre}`}
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPersonaDetalle(p);
                                        }}
                                    />
                                </div>
                            )
                        }
                    ]}
                    rows={liquidacion.personas}
                    rowKey={(p) => p.id_persona}
                    onRowClick={(p: PersonaAPagar) => setPersonaDetalle(p)}
                />
            </Card>

            <Card
                title="Pagos registrados"
                padded={false}
                footer={pagos.length ? `Total pagado: ${formatMoney(liquidacion.pagado)}` : undefined}
            >
                <Table
                    columns={[
                        { header: "Fecha", cell: ({ pago }: { pago: Pago }) => formatFecha(pago.fecha) },
                        { header: "Persona", cell: ({ persona }: { persona: PersonaAPagar }) => persona.nombre },
                        { header: "Monto", align: "right", mono: true, cell: ({ pago }: { pago: Pago }) => <b>{formatMoney(pago.monto)}</b> },
                        {
                            header: "Nota",
                            wrap: true,
                            cell: ({ pago }: { pago: Pago }) =>
                                pago.nota ?? <span style={{ color: "var(--text-subtle)" }}>—</span>
                        },
                        {
                            header: "",
                            width: 56,
                            align: "right",
                            cell: ({ pago, persona }: { pago: Pago; persona: PersonaAPagar }) => (
                                <IconButton
                                    icon="trash-2"
                                    label={`Anular el pago a ${persona.nombre}`}
                                    size="sm"
                                    onClick={() => anularPagoRegistrado(pago, persona)}
                                />
                            )
                        }
                    ]}
                    rows={pagos}
                    rowKey={({ pago }) => pago.id}
                    empty={
                        <EmptyState
                            icon="banknote"
                            title="Todavía no se registró ningún pago"
                            description="Cuando le pagues a alguien —todo o en partes— queda anotado acá."
                        />
                    }
                />
            </Card>

            {personaDetalleActual ? (
                <DetallePersonaDialog
                    nombre={personaDetalleActual.nombre}
                    roles={personaDetalleActual.roles}
                    detalle={personaDetalleActual.detalle}
                    total={personaDetalleActual.total}
                    pagos={personaDetalleActual.pagos}
                    onClose={() => setPersonaDetalle(null)}
                />
            ) : null}

            {/* `conSaldo.length` en la condición, no sólo en `actions`: al cerrar
                el último saldo el diálogo quedaría sin candidatos entre que se
                registra el pago y que se cierra. */}
            {pagarA !== undefined && conSaldo.length > 0 ? (
                <RegistrarPagoDialog
                    title="Registrar pago"
                    description={`Pago de la liquidación ${liquidacion.codigo}. Se puede pagar todo o una parte.`}
                    candidatos={conSaldo.map((p) => ({
                        id: p.id_persona,
                        nombre: p.nombre,
                        detalle: p.roles
                            .map((rol) => nombreVisible(rol.nombre))
                            .join(" · "),
                        saldo: p.saldo
                    }))}
                    candidatoInicial={pagarA ?? undefined}
                    onConfirm={confirmarPago}
                    onClose={() => setPagarA(undefined)}
                />
            ) : null}
        </div>
    );
}
