import { useState } from "react";
import { Badge, Icon } from "../../design-system";
import type { Coleccion } from "../../api/coleccion";

// Una colección es un objeto visual (tiene portada), así que el listado se
// resuelve con tarjetas y no con la tabla que usan libros/personas/clientes
// (ver "Decisiones de formato" en specs/006-colecciones/design.md). La
// portada es vertical, igual que la tapa de un libro: es el único material
// fotográfico previsto por el sistema (ver design-system/readme.md).
export function ColeccionCard({ coleccion, onOpen }: { coleccion: Coleccion; onOpen: () => void }) {
    const [hover, setHover] = useState(false);
    const [focus, setFocus] = useState(false);

    return (
        <section
            role="button"
            tabIndex={0}
            aria-label={`Abrir la colección ${coleccion.titulo}`}
            onClick={onOpen}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpen();
                }
            }}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            onFocus={() => setFocus(true)}
            onBlur={() => setFocus(false)}
            style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "var(--space-4)",
                padding: "var(--space-4)",
                textAlign: "left",
                cursor: "pointer",
                background: hover ? "var(--surface-hover)" : "var(--surface-card)",
                border: `1px solid ${hover || focus ? "var(--pino-500)" : "var(--border-subtle)"}`,
                borderRadius: "var(--radius-md)",
                // El foco de teclado es la señal violeta del sistema: borde
                // pino + anillo, igual que cualquier control (ver readme.md).
                boxShadow: focus ? "var(--ring-focus)" : hover ? "var(--shadow-md)" : "var(--shadow-xs)",
                outline: "none",
                transition: "var(--transition-control)"
            }}
        >
            <div
                style={{
                    width: 76,
                    height: 106,
                    flex: "0 0 auto",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--pino-800)",
                    boxShadow: "var(--shadow-xs)"
                }}
            >
                {coleccion.portada_url ? (
                    <img src={coleccion.portada_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                    <Icon name="library" size={22} color="var(--papel-0)" style={{ opacity: 0.55 }} />
                )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
                <h3
                    style={{
                        margin: 0,
                        fontFamily: "var(--font-display)",
                        fontSize: "var(--text-md)",
                        fontWeight: "var(--weight-semibold)",
                        letterSpacing: "var(--tracking-tight)"
                    }}
                >
                    {coleccion.titulo}
                </h3>
                {coleccion.descripcion ? (
                    <p
                        style={{
                            margin: "var(--space-2) 0 0",
                            fontSize: "var(--text-sm)",
                            lineHeight: "var(--leading-snug)",
                            color: "var(--text-muted)",
                            // Dos líneas: en una tarjeta de listado la descripción
                            // es un anticipo, no el contenido.
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden"
                        }}
                    >
                        {coleccion.descripcion}
                    </p>
                ) : null}
                <div style={{ marginTop: "var(--space-3)" }}>
                    <Badge tone={coleccion.cantidad_libros > 0 ? "brand" : "neutral"}>
                        {coleccion.cantidad_libros === 0
                            ? "Sin libros"
                            : coleccion.cantidad_libros === 1
                              ? "1 libro"
                              : `${coleccion.cantidad_libros} libros`}
                    </Badge>
                </div>
            </div>
        </section>
    );
}
