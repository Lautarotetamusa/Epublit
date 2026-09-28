import { Dialog, Table, Button, Badge } from "../../design-system";
import type { PersonaLiquidacionDetalle, PersonaLiquidada, TipoPersonaLiquidacion } from "../../api/liquidacion";
import { formatMoney } from "./money";

const TIPO_LABEL = { autor: "Autor", ilustrador: "Ilustrador" } as const;

// Los roles distintos presentes en el detalle (puede ser autora de un libro
// e ilustradora de otro en el mismo período).
function rolesDePersona(persona: PersonaLiquidada): TipoPersonaLiquidacion[] {
    const roles = new Set(persona.detalle.map((d) => d.tipo));
    return [...roles];
}

type Props = {
    persona: PersonaLiquidada;
    onClose: () => void;
};

export function DetallePersonaDialog({ persona, onClose }: Props) {
    return (
        <Dialog
            open
            title={persona.nombre}
            description="Importe por libro dentro del período liquidado."
            width={520}
            onClose={onClose}
            footer={
                <Button size="sm" onClick={onClose}>
                    Cerrar
                </Button>
            }
        >
            <div style={{ marginBottom: "var(--space-4)", display: "flex", gap: "var(--space-1)" }}>
                {rolesDePersona(persona).map((rol) => (
                    <Badge key={rol} tone={rol === "autor" ? "brand" : "accent"}>
                        {TIPO_LABEL[rol]}
                    </Badge>
                ))}
            </div>
            <Table
                columns={[
                    { header: "Libro", key: "titulo", wrap: true },
                    { header: "Rol", cell: (d: PersonaLiquidacionDetalle) => <Badge tone={d.tipo === "autor" ? "brand" : "accent"}>{TIPO_LABEL[d.tipo]}</Badge> },
                    { header: "Porcentaje", align: "right", mono: true, cell: (d) => `${d.porcentaje}%` },
                    { header: "Importe", align: "right", mono: true, cell: (d) => formatMoney(d.importe) }
                ]}
                rows={persona.detalle}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--space-4)", gap: "var(--space-2)" }}>
                <span style={{ color: "var(--papel-600)" }}>Total a pagar</span>
                <b style={{ fontFamily: "var(--font-mono)" }}>{formatMoney(persona.total_a_pagar)}</b>
            </div>
        </Dialog>
    );
}
