import { Badge, Button, EmptyState, IconButton } from "../../design-system";
import { formatFecha } from "../../lib/fecha";
import type { PaginaContenido } from "./tipos";

type ListaPaginasMovilProps = {
    paginas: PaginaContenido[];
    hayFiltro: boolean;
    cargandoId: string | null;
    onEditar: (pagina: PaginaContenido) => void;
    onPrevisualizar: (pagina: PaginaContenido) => void;
    onNueva: () => void;
};

// La tabla de siete columnas no se puede leer a 390px: en teléfono cada
// página pasa a ser una fila de dos niveles con las mismas acciones. No es
// una tarjeta (el sistema evita tarjetas dentro de tarjetas): es el mismo
// listado, con la jerarquía de la tabla.
export function ListaPaginasMovil({ paginas, hayFiltro, cargandoId, onEditar, onPrevisualizar, onNueva }: ListaPaginasMovilProps) {
    if (paginas.length === 0) {
        return (
            <div style={{ padding: "var(--space-8) var(--space-4)" }}>
                {hayFiltro ? (
                    <EmptyState
                        icon="search"
                        title="No hay páginas que coincidan"
                        description="Probá con otro término o cambiá el filtro de estado."
                    />
                ) : (
                    <EmptyState
                        icon="file-text"
                        title="Todavía no hay páginas"
                        description="Creá la primera página institucional y empezá a cargar sus bloques."
                        action={
                            <Button iconStart="plus" onClick={onNueva}>
                                Crear página
                            </Button>
                        }
                    />
                )}
            </div>
        );
    }

    return (
        <div>
            {paginas.map((pagina) => (
                <div key={pagina.id} style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border-subtle)" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-3)" }}>
                        <button
                            type="button"
                            onClick={() => onEditar(pagina)}
                            style={{
                                flex: 1,
                                minWidth: 0,
                                padding: 0,
                                background: "none",
                                border: "none",
                                textAlign: "left",
                                cursor: "pointer"
                            }}
                        >
                            <span style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: "var(--weight-semibold)", color: "var(--text-body)" }}>
                                {pagina.titulo.trim() || "Página sin título"}
                            </span>
                            <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: "var(--text-2xs)", color: "var(--text-muted)" }}>
                                /{pagina.slug || "sin-slug"}
                            </span>
                        </button>
                        <Badge tone={pagina.estado === "publicada" ? "success" : "warning"} dot>
                            {pagina.estado === "publicada" ? "Publicada" : "Borrador"}
                        </Badge>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
                        <span style={{ fontSize: "var(--text-2xs)", color: "var(--text-muted)", lineHeight: "var(--leading-normal)" }}>
                            {pagina.visibleEnMenu ? `En menú · ${pagina.orden}.º` : "Oculta del menú"} · {pagina.cantidadBloques}{" "}
                            {pagina.cantidadBloques === 1 ? "bloque" : "bloques"} · {formatFecha(pagina.actualizadaEn)}
                        </span>
                        <IconButton
                            type="button"
                            size="sm"
                            variant="ghost"
                            icon="eye"
                            label={`Previsualizar «${pagina.titulo || "página sin título"}»`}
                            disabled={cargandoId === pagina.id}
                            onClick={() => onPrevisualizar(pagina)}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}
