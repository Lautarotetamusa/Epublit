import { Icon } from "../../design-system";
import { TextoRico } from "./TextoRico";
import { VistaImagen } from "./VistaImagen";
import type { Bloque, PaginaContenido } from "./tipos";
import { etiquetaTipo } from "./tipos";

type PaginaPreviewProps = {
    pagina: PaginaContenido;
    menu: PaginaContenido[];
    movil: boolean;
};

export function PaginaPreview({ pagina, menu, movil }: PaginaPreviewProps) {
    const tieneHero = pagina.bloques.some((bloque) => bloque.tipo === "hero");

    return (
        <div style={{ background: "var(--papel-50)", minHeight: "100%", fontFamily: "var(--font-body)" }}>
            <header style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--papel-0)" }}>
                <div style={{ maxWidth: 760, margin: "0 auto", padding: movil ? "16px 20px" : "18px 32px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-4)", flexWrap: "wrap" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
                            <Icon name="book-open" size={17} color="var(--pino-600)" />
                            <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-md)", fontWeight: "var(--weight-semibold)", color: "var(--pino-900)", letterSpacing: "var(--tracking-tight)" }}>
                                Libros Silvestres
                            </span>
                        </span>
                        <nav style={{ display: "flex", alignItems: "center", gap: movil ? 12 : 18, flexWrap: "wrap" }} aria-label="Páginas del sitio">
                            {menu.map((item) => {
                                const actual = item.id === pagina.id;
                                return (
                                    <span
                                        key={item.id}
                                        style={{
                                            fontSize: "var(--text-xs)",
                                            fontWeight: actual ? "var(--weight-semibold)" : "var(--weight-medium)",
                                            color: actual ? "var(--pino-700)" : "var(--text-muted)",
                                            boxShadow: actual ? "inset 0 -1px 0 var(--pino-600)" : "none",
                                            paddingBottom: 2
                                        }}
                                    >
                                        {item.titulo || "Sin título"}
                                    </span>
                                );
                            })}
                        </nav>
                    </div>
                </div>
            </header>

            <main style={{ maxWidth: 760, margin: "0 auto", padding: movil ? "32px 20px 48px" : "52px 32px 72px" }}>
                {!tieneHero ? (
                    <h1
                        style={{
                            margin: 0,
                            marginBottom: "var(--space-8)",
                            fontFamily: "var(--font-display)",
                            fontSize: movil ? "var(--text-2xl)" : "var(--text-4xl)",
                            fontWeight: "var(--weight-semibold)",
                            lineHeight: "var(--leading-tight)",
                            letterSpacing: "var(--tracking-tight)",
                            color: "var(--pino-900)",
                            textWrap: "balance"
                        }}
                    >
                        {pagina.titulo.trim() || "Página sin título"}
                    </h1>
                ) : null}

                <div style={{ display: "flex", flexDirection: "column", gap: movil ? "var(--space-10)" : "var(--space-16)" }}>
                    {pagina.bloques.map((bloque) => (
                        <BloqueVista key={bloque.id} bloque={bloque} movil={movil} />
                    ))}
                    {pagina.bloques.length === 0 ? (
                        <div
                            style={{
                                padding: "var(--space-10)",
                                border: "1px dashed var(--border-strong)",
                                borderRadius: "var(--radius-md)",
                                textAlign: "center",
                                color: "var(--text-muted)",
                                fontSize: "var(--text-sm)"
                            }}
                        >
                            Todavía no hay bloques. Agregá el primero desde el editor.
                        </div>
                    ) : null}
                </div>
            </main>

            <footer style={{ borderTop: "1px solid var(--border-subtle)", background: "var(--papel-0)" }}>
                <div
                    style={{
                        maxWidth: 760,
                        margin: "0 auto",
                        padding: movil ? "16px 20px" : "18px 32px",
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "var(--space-3)",
                        flexWrap: "wrap",
                        fontSize: "var(--text-2xs)",
                        color: "var(--text-subtle)",
                        letterSpacing: "var(--tracking-caps)",
                        textTransform: "uppercase"
                    }}
                >
                    <span>Libros Silvestres · Editorial</span>
                    <span>vista previa</span>
                </div>
            </footer>
        </div>
    );
}

function BloqueVista({ bloque, movil }: { bloque: Bloque; movil: boolean }) {
    switch (bloque.tipo) {
        case "hero":
            return (
                <section>
                    <h1
                        style={{
                            margin: 0,
                            fontFamily: "var(--font-display)",
                            fontSize: movil ? "var(--text-2xl)" : "var(--text-4xl)",
                            fontWeight: "var(--weight-semibold)",
                            lineHeight: "var(--leading-tight)",
                            letterSpacing: "var(--tracking-tight)",
                            color: "var(--pino-900)",
                            textWrap: "balance"
                        }}
                    >
                        {bloque.titulo.trim() || "Título de apertura"}
                    </h1>
                    {bloque.bajada.trim() !== "" ? (
                        <p
                            style={{
                                margin: "var(--space-3) 0 0",
                                fontSize: movil ? "var(--text-base)" : "var(--text-md)",
                                lineHeight: "var(--leading-relaxed)",
                                color: "var(--text-muted)",
                                maxWidth: 560,
                                textWrap: "pretty"
                            }}
                        >
                            {bloque.bajada}
                        </p>
                    ) : null}
                    {bloque.imagen ? (
                        <div style={{ marginTop: "var(--space-8)" }}>
                            <VistaImagen imagen={bloque.imagen} movil={movil} />
                        </div>
                    ) : null}
                </section>
            );

        case "texto":
            if (bloque.titulo.trim() === "" && bloque.contenido.trim() === "") return <Vacio tipo={bloque.tipo} />;
            return (
                <section>
                    {bloque.titulo.trim() !== "" ? <TituloSeccion>{bloque.titulo}</TituloSeccion> : null}
                    <TextoRico texto={bloque.contenido} movil={movil} />
                </section>
            );

        case "imagen-texto":
            return (
                <section
                    style={{
                        display: "grid",
                        gridTemplateColumns: movil ? "1fr" : "1fr 1fr",
                        gap: movil ? "var(--space-4)" : "var(--space-8)",
                        alignItems: "start"
                    }}
                >
                    <div style={{ order: movil ? 0 : bloque.posicion === "izquierda" ? 0 : 1 }}>
                        {bloque.imagen ? (
                            <VistaImagen imagen={bloque.imagen} movil={movil} relacion="4 / 3" />
                        ) : (
                            <Vacio tipo="imagen-texto" />
                        )}
                    </div>
                    <div style={{ order: movil ? 1 : bloque.posicion === "izquierda" ? 1 : 0 }}>
                        {bloque.titulo.trim() !== "" ? <TituloSeccion>{bloque.titulo}</TituloSeccion> : null}
                        <TextoRico texto={bloque.texto} movil={movil} />
                    </div>
                </section>
            );

        case "galeria":
            return (
                <section>
                    {bloque.titulo.trim() !== "" ? <TituloSeccion>{bloque.titulo}</TituloSeccion> : null}
                    {bloque.imagenes.length === 0 ? (
                        <Vacio tipo="galeria" />
                    ) : (
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: movil ? "1fr" : `repeat(${bloque.columnas}, minmax(0, 1fr))`,
                                gap: "var(--space-3)"
                            }}
                        >
                            {bloque.imagenes.map((imagen) => (
                                <VistaImagen key={imagen.id} imagen={imagen} movil={movil} relacion="4 / 3" />
                            ))}
                        </div>
                    )}
                </section>
            );

        case "cita":
            if (bloque.texto.trim() === "") return <Vacio tipo="cita" />;
            return (
                <blockquote
                    style={{
                        margin: 0,
                        padding: "var(--space-6) 0",
                        borderTop: "1px solid var(--border-subtle)",
                        borderBottom: "1px solid var(--border-subtle)",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "var(--space-3)"
                    }}
                >
                    <Icon name="quote" size={movil ? 18 : 22} color="var(--violeta-500)" style={{ marginTop: 4 }} />
                    <div>
                        <p
                            style={{
                                margin: 0,
                                fontFamily: "var(--font-display)",
                                fontStyle: "italic",
                                fontSize: movil ? "var(--text-lg)" : "var(--text-xl)",
                                lineHeight: "var(--leading-snug)",
                                color: "var(--pino-900)",
                                textWrap: "pretty"
                            }}
                        >
                            {bloque.texto}
                        </p>
                        {bloque.autor.trim() !== "" || bloque.fuente.trim() !== "" ? (
                            <footer style={{ marginTop: "var(--space-4)", display: "flex", flexDirection: "column", gap: 1 }}>
                                <span style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-semibold)", color: "var(--text-body)" }}>
                                    {bloque.autor}
                                </span>
                                {bloque.fuente.trim() !== "" ? (
                                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{bloque.fuente}</span>
                                ) : null}
                            </footer>
                        ) : null}
                    </div>
                </blockquote>
            );

        case "datos":
            return (
                <section>
                    {bloque.titulo.trim() !== "" ? <TituloSeccion>{bloque.titulo}</TituloSeccion> : null}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: movil ? "1fr 1fr" : `repeat(${Math.min(bloque.items.length, 4)}, minmax(0, 1fr))`,
                            gap: "var(--space-4)"
                        }}
                    >
                        {bloque.items.map((item) => (
                            <div key={item.id} style={{ borderTop: "1px solid var(--border-default)", paddingTop: "var(--space-2)" }}>
                                <div
                                    style={{
                                        fontFamily: "var(--font-display)",
                                        fontSize: movil ? "var(--text-xl)" : "var(--text-2xl)",
                                        fontWeight: "var(--weight-semibold)",
                                        lineHeight: 1,
                                        letterSpacing: "var(--tracking-tight)",
                                        color: "var(--pino-800)"
                                    }}
                                >
                                    {item.valor || "—"}
                                </div>
                                {item.etiqueta.trim() !== "" ? (
                                    <div
                                        style={{
                                            marginTop: "var(--space-2)",
                                            fontSize: "var(--text-2xs)",
                                            letterSpacing: "var(--tracking-caps)",
                                            textTransform: "uppercase",
                                            color: "var(--text-muted)"
                                        }}
                                    >
                                        {item.etiqueta}
                                    </div>
                                ) : null}
                            </div>
                        ))}
                    </div>
                </section>
            );

        case "enlaces":
            return (
                <section>
                    {bloque.titulo.trim() !== "" ? <TituloSeccion>{bloque.titulo}</TituloSeccion> : null}
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        {bloque.items.map((item) => (
                            <a
                                key={item.id}
                                href={item.href || "#"}
                                onClick={(event) => event.preventDefault()}
                                style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    justifyContent: "space-between",
                                    gap: "var(--space-4)",
                                    padding: "var(--space-3) 0",
                                    borderBottom: "1px solid var(--border-subtle)",
                                    textDecoration: "none",
                                    color: "inherit"
                                }}
                            >
                                <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                    <span style={{ fontSize: "var(--text-sm)", fontWeight: "var(--weight-semibold)", color: "var(--pino-800)" }}>
                                        {item.etiqueta || "Enlace sin nombre"}
                                    </span>
                                    {item.descripcion.trim() !== "" ? (
                                        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", lineHeight: "var(--leading-normal)" }}>
                                            {item.descripcion}
                                        </span>
                                    ) : null}
                                </span>
                                <Icon name="arrow-up-right" size={16} color="var(--violeta-600)" style={{ marginTop: 2 }} />
                            </a>
                        ))}
                    </div>
                </section>
            );
    }
}

function TituloSeccion({ children }: { children: string }) {
    return (
        <h2
            style={{
                margin: "0 0 var(--space-4)",
                fontFamily: "var(--font-display)",
                fontSize: "var(--text-xl)",
                fontWeight: "var(--weight-semibold)",
                lineHeight: "var(--leading-tight)",
                letterSpacing: "var(--tracking-tight)",
                color: "var(--pino-900)",
                textWrap: "balance"
            }}
        >
            {children}
        </h2>
    );
}

function Vacio({ tipo }: { tipo: Bloque["tipo"] }) {
    return (
        <div
            style={{
                padding: "var(--space-5)",
                border: "1px dashed var(--border-strong)",
                borderRadius: "var(--radius-sm)",
                fontSize: "var(--text-xs)",
                color: "var(--text-muted)",
                textAlign: "center"
            }}
        >
            Bloque de {etiquetaTipo(tipo).toLowerCase()} sin contenido todavía.
        </div>
    );
}
