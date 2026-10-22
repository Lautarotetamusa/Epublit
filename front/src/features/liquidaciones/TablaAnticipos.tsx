import { Alert, Badge, Button, EmptyState, Table } from "../../design-system";
import type { Anticipo } from "../../api/liquidaciones";
import { useConfirm } from "../../notifications/ConfirmProvider";
import { useToast } from "../../notifications/ToastProvider";
import { getErrorMessage } from "../../lib/errors";
import { formatFecha } from "../../lib/fecha";
import { nombreVisible, tonoDeRol } from "../roles/presentacionRol";
import { formatMoney } from "../../lib/money";

type Props = {
    anticipos: Anticipo[];
    loading: boolean;
    onMarcarPagado: (idAnticipo: number) => Promise<void>;
};

// El anticipo se cobra una sola vez, al lanzar el libro, y se paga entero: por
// eso la única acción es marcarlo como pagado, sin monto ni parciales (el pago
// parcial vive en las liquidaciones, no acá). La reimpresión se muestra como dato
// (y como recordatorio de la regla) aunque no cambie nada del anticipo.
export function TablaAnticipos({ anticipos, loading, onMarcarPagado }: Props) {
    const { showToast } = useToast();
    const confirm = useConfirm();

    const marcarPagado = async (anticipo: Anticipo) => {
        const ok = await confirm({
            title: `¿Marcar como pagado el anticipo de ${anticipo.nombre}?`,
            description: `${formatMoney(anticipo.monto)} por «${anticipo.titulo}» (${nombreVisible(anticipo.rol.nombre)}). Se paga una sola vez y se registra con la fecha de hoy.`,
            confirmLabel: "Marcar como pagado"
        });
        if (!ok) return;

        try {
            await onMarcarPagado(anticipo.id);
            showToast("success", "Anticipo marcado como pagado");
        } catch (err) {
            showToast("error", getErrorMessage(err));
        }
    };

    return (
        <>
            <div style={{ padding: "var(--space-4) var(--space-5) 0" }}>
                <Alert tone="info" title="El anticipo se cobra una sola vez, al lanzar el libro">
                    Cada persona cobra un anticipo por el rol con el que participa de un libro nuevo. Si el libro se reimprime, no se genera
                    otro anticipo. Se paga entero y no se descuenta de las regalías que esa persona cobra por las ventas.
                </Alert>
            </div>

            <Table
            columns={[
                {
                    header: "Libro",
                    wrap: true,
                    cell: (a: Anticipo) => (
                        <div>
                            <div style={{ fontWeight: "var(--weight-semibold)" }}>{a.titulo}</div>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-2xs)", color: "var(--text-muted)" }}>
                                {a.isbn}
                            </div>
                            {a.reimpresiones > 0 ? (
                                <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-subtle)" }}>
                                    Reimpresión ×{a.reimpresiones} · sin anticipo nuevo
                                </div>
                            ) : (
                                <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-subtle)" }}>Lanzamiento</div>
                            )}
                        </div>
                    )
                },
                { header: "Persona", key: "nombre" },
                {
                    header: "Rol",
                    cell: (a: Anticipo) => <Badge tone={tonoDeRol(a.rol)}>{nombreVisible(a.rol.nombre)}</Badge>
                },
                { header: "Lanzamiento", cell: (a: Anticipo) => formatFecha(a.fecha_lanzamiento) },
                { header: "Monto", align: "right", mono: true, cell: (a: Anticipo) => formatMoney(a.monto) },
                {
                    header: "Estado",
                    cell: (a: Anticipo) =>
                        a.pagado ? (
                            <div>
                                <Badge tone="success" dot>
                                    Pagado
                                </Badge>
                                {a.fecha_pago ? (
                                    <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-muted)", marginTop: 2 }}>
                                        el {formatFecha(a.fecha_pago)}
                                    </div>
                                ) : null}
                            </div>
                        ) : (
                            <Badge tone="neutral">Pendiente</Badge>
                        )
                },
                {
                    header: "",
                    align: "right",
                    cell: (a: Anticipo) =>
                        !a.pagado ? (
                            <Button variant="secondary" size="sm" iconStart="check" onClick={() => marcarPagado(a)}>
                                Marcar como pagado
                            </Button>
                        ) : (
                            <span style={{ color: "var(--text-subtle)", fontSize: "var(--text-xs)" }}>—</span>
                        )
                }
            ]}
            rows={anticipos}
            empty={
                loading ? (
                    "Cargando…"
                ) : (
                    <EmptyState
                        icon="banknote"
                        title="Todavía no hay anticipos"
                        description="Se generan al lanzar un libro con personas y un rol asignados."
                    />
                )
            }
            />
        </>
    );
}
