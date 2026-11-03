import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge, Breadcrumb, Button, Card, EmptyState, Icon, Table } from "../../design-system";
import type { LibroConPersonas, PersonaEnLibro } from "../../api/libro";
import { formatFecha } from "../../lib/fecha";
import { formatMoney } from "../../lib/money";
import { FullscreenSpinner } from "../../components/FullscreenSpinner";
import { nombreVisible, tonoDeRol } from "../roles/presentacionRol";
import { useLibro } from "./useLibro";
import { StockLibroCard } from "./StockLibroCard";
import { medidasDeLibro, pesoDeLibro, rangoDeEdad } from "./presentacionLibro";

// Ficha de sólo lectura: qué es el libro, cómo se presenta y cuánto hay en
// stock. La edición vive en /libros/:isbn/editar para que el detalle se lea de
// un vistazo y el stock no comparta espacio con los campos editables.
export function FichaLibroPage() {
    const { isbn = "" } = useParams();
    const { libro, loading, error } = useLibro(isbn);
    const navigate = useNavigate();

    if (loading) return <FullscreenSpinner />;

    if (!libro) {
        return (
            <Card>
                <EmptyState
                    icon="library"
                    title="No se pudo cargar el libro"
                    description={error ?? "Puede que lo hayas eliminado, o que el enlace esté mal."}
                    action={<Button onClick={() => navigate("/libros")}>Volver a libros</Button>}
                />
            </Card>
        );
    }

    const editar = () => navigate(`/libros/${libro.isbn}/editar`);
    const abrirPersona = (persona: PersonaEnLibro) => navigate(`/personas/${persona.id_persona}`);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Breadcrumb items={["Libros", libro.titulo]} onNavigate={(_item, index) => index === 0 && navigate("/libros")} />

            <Card padded={false}>
                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "flex-start",
                        gap: "var(--space-6)",
                        padding: "var(--space-5)"
                    }}
                >
                    <PortadaLibro libro={libro} />

                    <div style={{ flex: "1 1 340px", minWidth: 0 }}>
                        <Badge tone="neutral">{libro.coleccion_titulo ?? "Sin colección"}</Badge>
                        <h1
                            style={{
                                margin: "var(--space-3) 0 0",
                                fontFamily: "var(--font-display)",
                                fontSize: "var(--text-xl)",
                                fontWeight: "var(--weight-semibold)",
                                letterSpacing: "var(--tracking-tight)",
                                lineHeight: "var(--leading-tight)"
                            }}
                        >
                            {libro.titulo}
                        </h1>
                        <p
                            style={{
                                margin: "var(--space-2) 0 0",
                                fontFamily: "var(--font-mono)",
                                fontSize: "var(--text-xs)",
                                color: "var(--text-muted)"
                            }}
                        >
                            ISBN {libro.isbn}
                        </p>

                        <dl
                            style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "var(--space-6)",
                                margin: "var(--space-5) 0 0"
                            }}
                        >
                            <Dato
                                label="Precio"
                                value={
                                    <span
                                        style={{
                                            fontFamily: "var(--font-mono)",
                                            fontSize: "var(--text-lg)",
                                            fontWeight: "var(--weight-semibold)"
                                        }}
                                    >
                                        {formatMoney(libro.precio)}
                                    </span>
                                }
                            />
                            <Dato label="Fecha de edición" value={formatFecha(libro.fecha_edicion)} />
                        </dl>

                        <Button iconStart="pencil" style={{ marginTop: "var(--space-5)" }} onClick={editar}>
                            Editar libro
                        </Button>
                    </div>
                </div>
            </Card>

            <Card title="Descripción" subtitle="El texto que se muestra en el catálogo y en la tienda.">
                {libro.brief ? (
                    <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: "var(--leading-relaxed)", color: "var(--text-body)" }}>
                        {libro.brief}
                    </p>
                ) : (
                    <p style={{ margin: 0, color: "var(--text-muted)" }}>Sin descripción cargada.</p>
                )}

                {libro.book_trailer_url ? (
                    <p style={{ margin: "var(--space-4) 0 0" }}>
                        <a
                            href={libro.book_trailer_url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", fontWeight: "var(--weight-semibold)" }}
                        >
                            <Icon name="external-link" size={14} />
                            Ver book trailer
                        </a>
                    </p>
                ) : null}
            </Card>

            <Card title="Ficha técnica" subtitle="Formato del libro y edad recomendada.">
                <dl
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                        gap: "var(--space-5)",
                        margin: 0
                    }}
                >
                    <Dato label="Páginas" value={libro.paginas ?? "—"} />
                    <Dato label="Edad recomendada" value={rangoDeEdad(libro.edad_min, libro.edad_max)} />
                    <Dato label="Medidas" value={medidasDeLibro(libro)} />
                    <Dato label="Peso" value={pesoDeLibro(libro.peso_kg)} />
                </dl>
            </Card>

            <StockLibroCard libro={libro} />

            <Card
                title="Personas en el libro"
                subtitle="Quién participó y con qué rol."
                padded={false}
                actions={
                    <Button variant="secondary" size="sm" iconStart="pencil" onClick={editar}>
                        Editar
                    </Button>
                }
            >
                <Table
                    columns={[
                        { header: "Nombre", key: "nombre", wrap: true },
                        {
                            header: "Rol",
                            cell: (persona: PersonaEnLibro) => (
                                <Badge tone={tonoDeRol(persona.rol)}>{nombreVisible(persona.rol.nombre)}</Badge>
                            )
                        },
                        {
                            header: "Participación",
                            align: "right",
                            mono: true,
                            cell: (persona: PersonaEnLibro) => `${persona.porcentaje}%`
                        },
                        {
                            header: "Anticipo",
                            align: "right",
                            mono: true,
                            cell: (persona: PersonaEnLibro) =>
                                persona.monto_acordado === null ? (
                                    <span style={{ color: "var(--text-subtle)" }}>—</span>
                                ) : (
                                    formatMoney(persona.monto_acordado)
                                )
                        }
                    ]}
                    rows={libro.personas}
                    rowKey={(persona) => `${persona.id_persona}-${persona.rol.id}`}
                    onRowClick={abrirPersona}
                    empty={
                        <EmptyState
                            icon="users"
                            title="Todavía no hay personas"
                            description="Agregá autores, ilustradores y otros roles desde la edición del libro."
                            action={
                                <Button variant="secondary" size="sm" onClick={editar}>
                                    Editar libro
                                </Button>
                            }
                        />
                    }
                />
            </Card>
        </div>
    );
}

function PortadaLibro({ libro }: { libro: LibroConPersonas }) {
    return (
        <div style={{ flex: "0 0 auto", width: "clamp(140px, 18vw, 190px)" }}>
            <div
                style={{
                    aspectRatio: "3 / 4",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                    background: libro.portada_url ? "var(--papel-0)" : "var(--pino-800)",
                    boxShadow: "var(--shadow-sm)"
                }}
            >
                {libro.portada_url ? (
                    <img
                        src={libro.portada_url}
                        alt={`Portada de ${libro.titulo}`}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                ) : (
                    <Icon name="book-marked" size={40} color="var(--papel-0)" style={{ opacity: 0.55 }} />
                )}
            </div>
        </div>
    );
}

function Dato({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div>
            <dt
                style={{
                    fontSize: "var(--text-2xs)",
                    textTransform: "uppercase",
                    letterSpacing: "var(--tracking-caps)",
                    color: "var(--text-muted)"
                }}
            >
                {label}
            </dt>
            <dd style={{ margin: "4px 0 0" }}>{value}</dd>
        </div>
    );
}
