import { Button } from "../../design-system";
import { formatCuentaRegresiva } from "../../lib/useCooldown";
import { useReenvioDeLink } from "./useReenvioDeLink";
import type { OpcionesReenvio } from "./useReenvioDeLink";

type Props = OpcionesReenvio & {
    variante?: "primary" | "secondary";
};

export function ReenviarLink({ variante = "secondary", ...opciones }: Props) {
    const { pedirOtroLink, enviando, resultado, esperaRestante, enEspera } = useReenvioDeLink(opciones);

    return (
        <div style={{ display: "grid", gap: resultado ? "var(--space-2)" : 0 }}>
            <Button
                type="button"
                variant={variante}
                iconStart={enEspera ? "clock" : "mail"}
                fullWidth
                loading={enviando}
                disabled={enEspera}
                onClick={pedirOtroLink}
            >
                {enEspera ? (
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>Reenviar link en {formatCuentaRegresiva(esperaRestante)}</span>
                ) : (
                    "Reenviar link"
                )}
            </Button>
            <p
                role="status"
                style={{
                    margin: 0,
                    fontSize: "var(--text-xs)",
                    textAlign: "center",
                    color: resultado?.tono === "error" ? "var(--text-error)" : "var(--text-muted)",
                    textWrap: "pretty"
                }}
            >
                {resultado?.texto}
            </p>
        </div>
    );
}
