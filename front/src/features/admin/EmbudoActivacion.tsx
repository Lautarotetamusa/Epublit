import { Card, ProgressBar } from "../../design-system";
import { formatEntero, formatPorcentaje } from "../../lib/numero";
import type { PasoEmbudo } from "./tipos";

const TONOS = ["brand", "brand", "accent"] as const;

function porcentajeDe(parte: number, total: number): number {
    return total === 0 ? 0 : (parte / total) * 100;
}

// El embudo es la pieza que explica la campaña: no sólo cuántas cuentas hay,
// sino en qué escalón se queda la mayoría. Cada barra se mide contra las
// cuentas y el pie traduce la fuga en cuentas con libro que no vendieron.
export function EmbudoActivacion({ pasos }: { pasos: PasoEmbudo[] }) {
    const cuentas = pasos[0]?.cantidad ?? 0;
    const conLibro = pasos[1]?.cantidad ?? 0;
    const conVenta = pasos[2]?.cantidad ?? 0;
    const sinVenta = Math.max(0, conLibro - conVenta);

    return (
        <Card
            title="Embudo de activación"
            subtitle="Dónde se frena la activación."
            footer={
                sinVenta > 0 ? (
                    <span>
                        {formatEntero(sinVenta)} de {formatEntero(conLibro)} cuentas con libro todavía no
                        vendieron.
                    </span>
                ) : (
                    <span>Todas las cuentas que cargaron un libro llegaron a la primera venta.</span>
                )
            }
        >
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
                {pasos.map((paso, indice) => {
                    const pctCuentas = porcentajeDe(paso.cantidad, cuentas);

                    return (
                        <div key={paso.clave}>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "baseline",
                                    justifyContent: "space-between",
                                    gap: "var(--space-4)"
                                }}
                            >
                                <span
                                    style={{
                                        fontSize: "var(--text-sm)",
                                        fontWeight:
                                            indice === pasos.length - 1
                                                ? "var(--weight-semibold)"
                                                : "var(--weight-medium)",
                                        color: "var(--text-body)"
                                    }}
                                >
                                    {paso.label}
                                </span>
                                <span style={{ display: "flex", alignItems: "baseline", gap: 5, flexShrink: 0 }}>
                                    <span
                                        style={{
                                            fontFamily: "var(--font-display)",
                                            fontSize: "var(--text-xl)",
                                            fontWeight: "var(--weight-medium)",
                                            letterSpacing: "var(--tracking-tight)",
                                            color:
                                                indice === pasos.length - 1
                                                    ? "var(--violeta-700)"
                                                    : "var(--text-body)"
                                        }}
                                    >
                                        {formatEntero(paso.cantidad)}
                                    </span>
                                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                                        cuentas
                                    </span>
                                </span>
                            </div>

                            {indice === 0 ? null : (
                                <>
                                    <ProgressBar
                                        aria-hidden
                                        value={pctCuentas}
                                        tone={TONOS[indice]}
                                        showValue={false}
                                        size="sm"
                                        style={{ marginTop: "var(--space-2)" }}
                                    />
                                    <div
                                        style={{
                                            marginTop: 5,
                                            fontSize: "var(--text-2xs)",
                                            color: "var(--text-muted)"
                                        }}
                                    >
                                        {formatPorcentaje(pctCuentas)} de las cuentas
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}
