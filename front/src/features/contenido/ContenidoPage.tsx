import { useNavigate } from "react-router-dom";
import { Alert, Badge, Button, Card, EmptyState, Field, Icon, IconButton, Input, Table, Tabs } from "../../design-system";
import { FullscreenSpinner } from "../../components/FullscreenSpinner";
import { formatFecha } from "../../lib/fecha";
import { useMediaQuery } from "../../lib/useMediaQuery";
import { usePaginasContenido } from "./usePaginasContenido";
import type { FiltroEstadoPaginas } from "./usePaginasContenido";
import { ListaPaginasMovil } from "./ListaPaginasMovil";
import { PrevisualizacionPagina } from "./PrevisualizacionPagina";
import { usePrevisualizarPagina } from "./usePrevisualizarPagina";
import type { PaginaContenido } from "./tipos";

export function ContenidoPage() {
    const { paginas, visibles, filtro, setFiltro, busqueda, setBusqueda, conteos, loading, error, recargar } =
        usePaginasContenido();
    const { pagina: previsualizada, cargandoId, abrir, cerrar } = usePrevisualizarPagina();
    const navigate = useNavigate();
    const esMovil = useMediaQuery("(max-width: 760px)");

    // Sólo la primera carga (o una búsqueda sin resultados previos) tapa la
    // pantalla: al filtrar o buscar de nuevo se mantiene el listado visible.
    if (loading && paginas.length === 0 && !error) return <FullscreenSpinner />;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "var(--space-4)", flexWrap: "wrap" }}>
                <div>
                    <h1
                        style={{
                            margin: 0,
                            fontFamily: "var(--font-display)",
                            fontSize: "var(--text-lg)",
                            fontWeight: "var(--weight-semibold)",
                            letterSpacing: "var(--tracking-tight)"
                        }}
                    >
                        Contenido del sitio
                    </h1>
                    <p style={{ margin: "var(--space-1) 0 0", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                        Las páginas institucionales de tu landing. Escribí, previsualizá y publicá sin depender de un desarrollador.
                    </p>
                </div>
                <Button iconStart="plus" onClick={() => navigate("/contenido/nueva")}>
                    Nueva página
                </Button>
            </header>

            <Card padded={false}>
                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "flex-end",
                        justifyContent: "space-between",
                        gap: "var(--space-4)",
                        padding: "var(--space-4) var(--space-5)",
                        borderBottom: "1px solid var(--border-subtle)"
                    }}
                >
                    <div style={{ flex: "1 1 320px", minWidth: 260 }}>
                        <Tabs
                            style={{ borderBottom: "none" }}
                            items={[
                                { value: "todas", label: "Todas", count: conteos.todas },
                                { value: "publicadas", label: "Publicadas", count: conteos.publicadas },
                                { value: "borradores", label: "Borradores", count: conteos.borradores }
                            ]}
                            value={filtro}
                            onChange={(valor) => setFiltro(valor as FiltroEstadoPaginas)}
                        />
                    </div>
                    <Field label="Buscar página" style={{ flex: "0 1 300px" }}>
                        <Input
                            iconStart="search"
                            placeholder="Por título o slug…"
                            value={busqueda}
                            onChange={(event) => setBusqueda(event.target.value)}
                        />
                    </Field>
                </div>

                {error ? (
                    <div style={{ padding: "var(--space-4) var(--space-5)" }}>
                        <Alert tone="error" title="No pudimos cargar las páginas">
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", flexWrap: "wrap" }}>
                                <span>{error}</span>
                                <Button size="sm" variant="secondary" onClick={recargar}>
                                    Reintentar
                                </Button>
                            </div>
                        </Alert>
                    </div>
                ) : esMovil ? (
                    <ListaPaginasMovil
                        paginas={visibles}
                        hayFiltro={busqueda.trim() !== "" || filtro !== "todas"}
                        cargandoId={cargandoId}
                        onEditar={(pagina) => navigate(`/contenido/${pagina.id}`)}
                        onPrevisualizar={abrir}
                        onNueva={() => navigate("/contenido/nueva")}
                    />
                ) : (
                <Table
                    columns={[
                        {
                            header: "Página",
                            cell: (pagina: PaginaContenido) => (
                                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                                    <span style={{ fontWeight: "var(--weight-semibold)", color: "var(--text-body)" }}>
                                        {pagina.titulo.trim() || "Página sin título"}
                                    </span>
                                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-2xs)", color: "var(--text-muted)" }}>
                                        /{pagina.slug || "sin-slug"}
                                    </span>
                                </div>
                            )
                        },
                        {
                            header: "Estado",
                            width: 130,
                            cell: (pagina: PaginaContenido) => (
                                <Badge tone={pagina.estado === "publicada" ? "success" : "warning"} dot>
                                    {pagina.estado === "publicada" ? "Publicada" : "Borrador"}
                                </Badge>
                            )
                        },
                        {
                            header: "Menú",
                            width: 130,
                            cell: (pagina: PaginaContenido) =>
                                pagina.visibleEnMenu ? (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--text-xs)" }}>
                                        <Icon name="menu" size={14} color="var(--text-subtle)" />
                                        <span>{pagina.orden}.º</span>
                                    </span>
                                ) : (
                                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Oculta</span>
                                )
                        },
                        {
                            header: "Bloques",
                            width: 90,
                            mono: true,
                            align: "right",
                            cell: (pagina: PaginaContenido) => pagina.cantidadBloques
                        },
                        {
                            header: "Última edición",
                            width: 140,
                            muted: true,
                            cell: (pagina: PaginaContenido) => formatFecha(pagina.actualizadaEn)
                        },
                        {
                            header: "",
                            align: "right",
                            width: 96,
                            cell: (pagina: PaginaContenido) => (
                                <div style={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
                                    <IconButton
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        icon="eye"
                                        label={`Previsualizar «${pagina.titulo || "página sin título"}»`}
                                        disabled={cargandoId === pagina.id}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            void abrir(pagina);
                                        }}
                                    />
                                    <IconButton
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        icon="pencil"
                                        label={`Editar «${pagina.titulo || "página sin título"}»`}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            navigate(`/contenido/${pagina.id}`);
                                        }}
                                    />
                                </div>
                            )
                        }
                    ]}
                    rows={visibles}
                    onRowClick={(pagina: PaginaContenido) => navigate(`/contenido/${pagina.id}`)}
                    empty={
                        loading ? (
                            <div style={{ padding: "var(--space-8)", textAlign: "center", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                                Buscando páginas…
                            </div>
                        ) : busqueda.trim() !== "" || filtro !== "todas" ? (
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
                                    <Button iconStart="plus" onClick={() => navigate("/contenido/nueva")}>
                                        Crear página
                                    </Button>
                                }
                            />
                        )
                    }
                />
                )}

                {visibles.length > 0 ? (
                    <div style={{ padding: "var(--space-3) var(--space-5)", borderTop: "1px solid var(--border-subtle)", background: "var(--papel-50)", display: "flex", justifyContent: "space-between", gap: "var(--space-3)", flexWrap: "wrap", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                        <span>
                            {conteos.todas} {conteos.todas === 1 ? "página" : "páginas"} · {conteos.publicadas} publicadas · {conteos.borradores} en borrador
                        </span>
                        <span>{loading ? "Actualizando…" : "La publicación en la landing se conecta en la próxima fase."}</span>
                    </div>
                ) : null}
            </Card>

            {previsualizada ? (
                <PrevisualizacionPagina pagina={previsualizada} open onClose={cerrar} />
            ) : null}
        </div>
    );
}
