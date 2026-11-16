import { Dialog, Table, Button, Badge, ProgressBar } from "../../design-system";
import type { PersonaLiquidacionDetalle } from "../../api/liquidacion";
import type { Pago } from "../../api/liquidaciones";
import type { Rol } from "../../api/rol";
import { formatMoney } from "../../lib/money";
import { formatFecha } from "../../lib/fecha";
import { nombreVisible, tonoDeRol } from "../roles/presentacionRol";
import { useImprimirDocumento } from "../../lib/useImprimirDocumento";
import { porcentajePagado } from "./presentacionLiquidacion";
import type { ReporteAutor } from "./ReporteAutorDocumento";
import { ReporteAutorImpresion } from "./ReporteAutorImpresion";

type Props = {
    nombre: string;
    roles: Rol[];
    detalle: PersonaLiquidacionDetalle[];
    totalBruto: number;
    anticipo: number;
    total: number;
    /** Los pagos ya registrados: sólo los tiene una persona de una liquidación generada. */
    pagos?: Pago[];
    /** Reporte imprimible de la persona: sólo existe para una liquidación generada. */
    reporte?: ReporteAutor;
    onClose: () => void;
};

// Sirve para una persona de la previsualización (reporte, sin pagos) y para una
// de la ficha generada (con pagos): por eso recibe los campos explícitos en vez
// de un tipo de persona, que difiere entre las dos formas.
export function DetallePersonaDialog({ nombre, roles, detalle, totalBruto, anticipo, total, pagos, reporte, onClose }: Props) {
    const pagado = pagos?.reduce((suma, pago) => suma + pago.monto, 0) ?? 0;
    const saldo = Math.max(0, total - pagado);
    const { imprimir } = useImprimirDocumento({ claseDocumento: "reporte-autor-documento" });

    // El título del documento es el nombre de archivo que propone «Guardar como PDF».
    const descargarPdf = async () => {
        if (!reporte) return;
        const anterior = document.title;
        document.title = `${reporte.liquidacion.codigo} - ${reporte.persona.nombre}`;
        await imprimir();
        document.title = anterior;
    };

    return (
        <Dialog
            open
            title={nombre}
            width={720}
            onClose={onClose}
            footer={
                <>
                    {reporte ? (
                        <Button variant="secondary" size="sm" iconStart="download" onClick={descargarPdf}>
                            Descargar PDF
                        </Button>
                    ) : null}
                    <Button size="sm" onClick={onClose}>
                        Cerrar
                    </Button>
                </>
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
                    // Con un solo rol ya está en el encabezado: repetirlo por fila sólo suma ancho.
                    ...(roles.length > 1
                        ? [
                              {
                                  header: "Rol",
                                  cell: (d: PersonaLiquidacionDetalle) => (
                                      <Badge tone={tonoDeRol(d.rol)}>{nombreVisible(d.rol.nombre)}</Badge>
                                  )
                              }
                          ]
                        : []),
                    { header: "Ejemplares", align: "right", mono: true, key: "cantidad" },
                    { header: "Porcentaje", align: "right", mono: true, cell: (d) => `${d.porcentaje}%` },
                    { header: "Importe", align: "right", mono: true, cell: (d) => formatMoney(d.importe) },
                    ...(anticipo > 0
                        ? [
                              {
                                  header: "Anticipo",
                                  align: "right" as const,
                                  mono: true,
                                  cell: (d: PersonaLiquidacionDetalle) =>
                                      d.anticipo > 0 ? `− ${formatMoney(d.anticipo)}` : <span style={{ color: "var(--text-subtle)" }}>—</span>
                              }
                          ]
                        : [])
                ]}
                rows={detalle}
            />

            <div style={{ display: "grid", gap: "var(--space-2)", marginTop: "var(--space-4)" }}>
                {anticipo > 0 ? (
                    <>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)" }}>
                            <span style={{ color: "var(--papel-600)" }}>Regalías</span>
                            <b style={{ fontFamily: "var(--font-mono)" }}>{formatMoney(totalBruto)}</b>
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)" }}>
                            <span style={{ color: "var(--papel-600)" }}>Anticipo recuperado</span>
                            <b style={{ fontFamily: "var(--font-mono)" }}>− {formatMoney(anticipo)}</b>
                        </div>
                    </>
                ) : null}
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "baseline", gap: "var(--space-2)" }}>
                    <span style={{ color: "var(--papel-600)" }}>Total a pagar</span>
                    <b style={{ fontFamily: "var(--font-mono)" }}>{formatMoney(total)}</b>
                </div>
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
            {reporte ? <ReporteAutorImpresion reporte={reporte} /> : null}
        </Dialog>
    );
}
