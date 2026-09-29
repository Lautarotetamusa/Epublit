import { Icon } from "../../design-system";
import type { Extremo } from "../../api/deposito";

type Props = {
    extremo: Extremo;
    // "fijo" es el extremo que el tipo de movimiento deja clavado (el exterior)
    // y ocupa el lugar de un control; "inline" es el que va en el historial y en
    // el detalle del movimiento.
    variante?: "fijo" | "inline";
};

// Un extremo de un movimiento, siempre con el mismo par de iconos para que la
// dirección se lea de un vistazo: `building-2` para un depósito, `arrow-up-right`
// para el exterior.
export function ExtremoDisplay({ extremo, variante = "inline" }: Props) {
    const esExterior = extremo.tipo === "exterior";
    const icono = esExterior ? "arrow-up-right" : "building-2";
    const texto = esExterior ? "Exterior" : extremo.nombre;

    if (variante === "fijo") {
        return (
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    height: "var(--height-control)",
                    padding: "0 var(--space-3)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--papel-100)",
                    fontSize: "var(--text-sm)",
                    color: "var(--text-body)"
                }}
            >
                <Icon name={icono} size={15} color="var(--text-subtle)" />
                {texto}
            </div>
        );
    }

    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--space-2)",
                color: esExterior ? "var(--text-muted)" : "var(--text-body)"
            }}
        >
            <Icon name={icono} size={14} color="var(--text-subtle)" />
            {texto}
        </span>
    );
}
