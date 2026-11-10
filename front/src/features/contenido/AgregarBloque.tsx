import { Card, Icon } from "../../design-system";
import { TIPOS_BLOQUE } from "./tipos";
import type { TipoBloque } from "./tipos";

// Paleta de bloques siempre visible al final del editor: agregar contenido no
// depende de un menú escondido ni de recordar nombres de plantillas. Cada
// opción dice qué hace, en el vocabulario de la editora.
export function AgregarBloque({ onAgregar }: { onAgregar: (tipo: TipoBloque) => void }) {
    return (
        <Card title="Agregar bloque" subtitle="Sumá contenido debajo del último bloque de la página.">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "var(--space-2)" }}>
                {TIPOS_BLOQUE.map((tipo) => (
                    <button
                        key={tipo.tipo}
                        type="button"
                        onClick={() => onAgregar(tipo.tipo)}
                        style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "var(--space-3)",
                            padding: "var(--space-3)",
                            textAlign: "left",
                            background: "var(--papel-0)",
                            border: "1px solid var(--border-subtle)",
                            borderRadius: "var(--radius-sm)",
                            cursor: "pointer",
                            transition: "var(--transition-control)"
                        }}
                        onMouseEnter={(event) => {
                            event.currentTarget.style.background = "var(--papel-50)";
                            event.currentTarget.style.borderColor = "var(--border-default)";
                        }}
                        onMouseLeave={(event) => {
                            event.currentTarget.style.background = "var(--papel-0)";
                            event.currentTarget.style.borderColor = "var(--border-subtle)";
                        }}
                    >
                        <span
                            aria-hidden="true"
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: 30,
                                height: 30,
                                flex: "0 0 auto",
                                borderRadius: "var(--radius-sm)",
                                background: "var(--papel-100)",
                                color: "var(--text-brand)"
                            }}
                        >
                            <Icon name={tipo.icon} size={16} />
                        </span>
                        <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                            <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", fontWeight: "var(--weight-semibold)", color: "var(--text-body)" }}>
                                {tipo.label}
                            </span>
                            <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-xs)", color: "var(--text-muted)", lineHeight: "var(--leading-normal)" }}>
                                {tipo.descripcion}
                            </span>
                        </span>
                    </button>
                ))}
            </div>
        </Card>
    );
}
