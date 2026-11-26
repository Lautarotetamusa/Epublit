import { useNavigate } from "react-router-dom";
import { Button, Card, EmptyState, Table } from "../../design-system";
import { FullscreenSpinner } from "../../components/FullscreenSpinner";
import type { TipoEdicion } from "../../api/tipoEdicion";
import { useTiposEdicion } from "./useTiposEdicion";

export function TiposEdicionPage() {
    const { tipos, loading } = useTiposEdicion();
    const navigate = useNavigate();

    if (loading) return <FullscreenSpinner />;

    return (
        <Card
            title="Tipos de edición"
            subtitle="Se eligen al cargar un libro. Dar de baja un tipo no cambia los libros que ya lo usan."
            actions={
                <Button iconStart="plus" onClick={() => navigate("/tipos-edicion/nuevo")}>
                    Nuevo tipo de edición
                </Button>
            }
            padded={false}
        >
            <Table
                columns={[{ header: "Nombre", cell: (row: TipoEdicion) => row.nombre }]}
                rows={tipos}
                onRowClick={(row: TipoEdicion) => navigate(`/tipos-edicion/${row.id}`)}
                empty={
                    <EmptyState
                        icon="book-marked"
                        title="Todavía no hay tipos de edición"
                        description="Cargá los tipos con los que editás tus libros para poder elegirlos al darlos de alta."
                    />
                }
            />
        </Card>
    );
}
