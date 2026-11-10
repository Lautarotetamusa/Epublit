import { useState } from "react";
import { Card, Icon, IconButton } from "../../design-system";
import { useConfirm } from "../../notifications/ConfirmProvider";
import { BloqueCampos } from "./BloqueCampos";
import { etiquetaTipo, iconoTipo, resumenBloque } from "./tipos";
import type { Bloque } from "./tipos";

type BloqueCardProps = {
    bloque: Bloque;
    indice: number;
    total: number;
    arrastrando: boolean;
    sobre: boolean;
    onChange: (patch: Partial<Bloque>) => void;
    onMover: (origen: number, destino: number) => void;
    onEliminar: (id: string) => void;
    onDragStart: () => void;
    onDragEnd: () => void;
    onDragEnter: () => void;
    onDrop: () => void;
};

export function BloqueCard({
    bloque,
    indice,
    total,
    arrastrando,
    sobre,
    onChange,
    onMover,
    onEliminar,
    onDragStart,
    onDragEnd,
    onDragEnter,
    onDrop
}: BloqueCardProps) {
    const [colapsado, setColapsado] = useState(false);
    const confirm = useConfirm();
    const tipo = etiquetaTipo(bloque.tipo);

    const eliminar = async () => {
        const ok = await confirm({
            title: `¿Eliminar el bloque «${tipo}»?`,
            description: "Se va a quitar de esta página cuando guardes. Si todavía no guardaste, todavía podés descartar los cambios.",
            confirmLabel: "Eliminar bloque",
            tone: "danger"
        });
        if (ok) onEliminar(bloque.id);
    };

    return (
        <Card
            id={`bloque-${bloque.id}`}
            padded={false}
            onDragOver={(event) => {
                event.preventDefault();
                onDragEnter();
            }}
            onDrop={(event) => {
                event.preventDefault();
                onDrop();
            }}
            style={{
                borderColor: sobre ? "var(--pino-500)" : undefined,
                boxShadow: sobre ? "var(--ring-focus)" : undefined,
                opacity: arrastrando ? 0.45 : 1,
                transition: "var(--transition-control)"
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-2) var(--space-3) var(--space-2) var(--space-2)" }}>
                <span
                    draggable
                    onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", bloque.id);
                        onDragStart();
                    }}
                    onDragEnd={onDragEnd}
                    title="Arrastrá para reordenar"
                    aria-hidden="true"
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 22,
                        height: 32,
                        color: "var(--text-subtle)",
                        cursor: "grab",
                        flex: "0 0 auto"
                    }}
                >
                    <Icon name="grip-vertical" size={16} />
                </span>

                <span
                    aria-hidden="true"
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 32,
                        height: 32,
                        flex: "0 0 auto",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--papel-100)",
                        color: "var(--text-brand)"
                    }}
                >
                    <Icon name={iconoTipo(bloque.tipo)} size={16} />
                </span>

                <button
                    type="button"
                    onClick={() => setColapsado((valor) => !valor)}
                    aria-expanded={!colapsado}
                    style={{
                        flex: 1,
                        minWidth: 0,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        gap: 1,
                        padding: "4px 0",
                        background: "none",
                        border: "none",
                        textAlign: "left",
                        cursor: "pointer"
                    }}
                >
                    <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-sm)", fontWeight: "var(--weight-semibold)", color: "var(--text-body)" }}>
                        {tipo}
                    </span>
                    <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-xs)", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                        {resumenBloque(bloque)}
                    </span>
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: 1, flex: "0 0 auto" }}>
                    <IconButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        icon="arrow-up"
                        label={`Subir ${tipo}`}
                        disabled={indice === 0}
                        onClick={() => onMover(indice, indice - 1)}
                    />
                    <IconButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        icon="arrow-down"
                        label={`Bajar ${tipo}`}
                        disabled={indice === total - 1}
                        onClick={() => onMover(indice, indice + 1)}
                    />
                    <IconButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        icon={colapsado ? "chevron-right" : "chevron-down"}
                        label={colapsado ? "Expandir bloque" : "Contraer bloque"}
                        onClick={() => setColapsado((valor) => !valor)}
                    />
                    <IconButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        icon="trash-2"
                        label={`Eliminar ${tipo}`}
                        onClick={eliminar}
                    />
                </div>
            </div>

            {!colapsado ? (
                <div style={{ padding: "var(--space-4)", borderTop: "1px solid var(--border-subtle)" }}>
                    <BloqueCampos bloque={bloque} onChange={onChange} />
                </div>
            ) : null}
        </Card>
    );
}
