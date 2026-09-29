import { useNavigate } from "react-router-dom";
import { Button, Card, EmptyState } from "../../design-system";
import { FullscreenSpinner } from "../../components/FullscreenSpinner";
import { useColecciones } from "./useColecciones";
import { ColeccionCard } from "./ColeccionCard";

export function ColeccionesPage() {
    const { colecciones, loading } = useColecciones();
    const navigate = useNavigate();

    if (loading) return <FullscreenSpinner />;

    const totalLibros = colecciones.reduce((total, coleccion) => total + coleccion.cantidad_libros, 0);
    const irANueva = () => navigate("/colecciones/nuevo");

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            {/* El título de la página no va dentro de un Card porque el
                contenido ya son tarjetas: una tarjeta dentro de otra está
                descartado por el piso de calidad del sistema. */}
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
                        Colecciones
                    </h1>
                    <p style={{ margin: "var(--space-1) 0 0", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                        {colecciones.length === 0
                            ? "Agrupá títulos para exhibirlos o venderlos juntos."
                            : `${colecciones.length} en total · ${totalLibros} libros agrupados`}
                    </p>
                </div>
                <Button iconStart="plus" onClick={irANueva}>
                    Nueva colección
                </Button>
            </header>

            {colecciones.length === 0 ? (
                <Card>
                    <EmptyState
                        icon="library"
                        title="Todavía no hay colecciones"
                        description="Cuando agrupes títulos en una colección, aparecen acá con su portada y sus libros."
                        action={
                            <Button iconStart="plus" onClick={irANueva}>
                                Crear colección
                            </Button>
                        }
                    />
                </Card>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "var(--space-4)" }}>
                    {colecciones.map((coleccion) => (
                        <ColeccionCard
                            key={coleccion.id}
                            coleccion={coleccion}
                            onOpen={() => navigate(`/colecciones/${coleccion.id}`)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
