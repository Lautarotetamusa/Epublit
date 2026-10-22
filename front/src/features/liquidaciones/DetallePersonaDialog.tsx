import { Dialog, Table, Button, Badge, ProgressBar } from "../../design-system";
import type { PersonaLiquidacionDetalle } from "../../api/liquidacion";
import type { Pago } from "../../api/liquidaciones";
import type { Rol } from "../../api/rol";
import { formatMoney } from "../../lib/money";
import { formatFecha } from "../../lib/fecha";
import { nombreVisible, tonoDeRol } from "../roles/presentacionRol";
import { porcentajePagado } from "./presentacionLiquidacion";

type Props = {
    nombre: string;
    roles: Rol[];
    detalle: PersonaLiquidacionDetalle[];
    total: number;
    /** Los pagos ya registrados: sólo los tiene una persona de una liquidación generada. */
    pagos?: Pago[];
    onClose: () => void;
};

// Sirve para una persona de la previsualización (reporte, sin pagos) y para una
// de la ficha generada (con pagos): por eso recibe los campos explícitos en vez
// de un tipo de persona, que difiere entre las dos formas.
export function DetallePersonaDialog({ nombre, roles, detalle, total, pagos, onClose }: Props) {
    const pagado = pagos?.reduce((suma, pago) => suma + pago.monto, 0) ?? 0;
    const saldo = Math.max(0, total - pagado);

    return (
        <Dialog
            open
            title={nombre}
            description="Importe por libro dentro del período liquidado."
            width={560}
            onClose={onClose}
            footer={
                <Button size="sm" onClick={onClose}>
                    Cerrar
                </Button>
            }
        >
            <div style={{ marginBottom: "var(--space-4)", display: "flex", gap: "var(--space-1)" }}>
                {roles.map((rol) => (
                    <Badge key={rol.id} tone={tonoDeRol(rol)}>
                        {nombreVisible(rol.nombre)}
                    </Badge>
                ))}
            </div>
            <Table
                columns={[
                    { header: "Libro", key: "titulo", wrap: true },
                    {
                        header: "Rol",
                        cell: (d: PersonaLiquidacionDetalle) => <Badge tone={tonoDeRol(d.rol)}>{nombreVisible(d.rol.nombre)}</Badge>
                    },
                    { header: "Porcentaje", align: "right", mono: true, cell: (d) => `${d.porcentaje}%` },
                    { header: "Importe", align: "right", mono: true, cell: (d) => formatMoney(d.importe) }
                ]}
                rows={detalle}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "baseline", gap: "var(--space-2)", marginTop: "var(--space-4)" }}>
                <span style={{ color: "var(--papel-600)" }}>Total a pagar</span>
                <b style={{ fontFamily: "var(--font-mono)" }}>{formatMoney(total)}</b>
            </div>

            {pagos ? (
                <div style={{ marginTop: "var(--space-5)", borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--space-4)" }}>
                    <ProgressBar value={porcentajePagado(total, pagado)} label="Pagado" tone={saldo === 0 ? "success" : "brand"} />
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-3)", fontSize: "var(--text-sm)" }}>
                        <span style={{ color: "var(--text-muted)" }}>Pagado {formatMoney(pagado)}</span>
                        <span style={{ fontWeight: "var(--weight-semibold)" }}>Falta {formatMoney(saldo)}</span>
                    </div>

                    {pagos.length ? (
                        <div style={{ marginTop: "var(--space-3)" }}>
                            <Table
                                dense
                                columns={[
                                    { header: "Fecha", cell: (p: Pago) => formatFecha(p.fecha) },
                                    { header: "Monto", align: "right", mono: true, cell: (p: Pago) => formatMoney(p.monto) },
                                    {
                                        header: "Nota",
                                        wrap: true,
                                        cell: (p: Pago) => p.nota ?? <span style={{ color: "var(--text-subtle)" }}>—</span>
                                    }
                                ]}
                                rows={pagos}
                                rowKey={(p: Pago) => p.id}
                            />
                        </div>
                    ) : (
                        <p style={{ margin: "var(--space-3) 0 0", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                            Todavía no se registró ningún pago a esta persona.
                        </p>
                    )}
                </div>
            ) : null}
        </Dialog>
    );
}
