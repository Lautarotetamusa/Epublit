import { useNavigate } from "react-router-dom";
import { Button, Card, EmptyState, Table } from "../../design-system";
import { FullscreenSpinner } from "../../components/FullscreenSpinner";
import type { Rol } from "../../api/rol";
import { useRoles } from "./useRoles";
import { nombreVisible } from "./presentacionRol";

export function RolesPage() {
    const { roles, loading } = useRoles();
    const navigate = useNavigate();

    if (loading) return <FullscreenSpinner />;

    return (
        <Card
            title="Roles"
            subtitle="Con qué rol trabaja cada persona en tus libros. Un rol que ya está en uso no se puede dar de baja."
            actions={
                <Button iconStart="plus" onClick={() => navigate("/roles/nuevo")}>
                    Nuevo rol
                </Button>
            }
            padded={false}
        >
            <Table
                columns={[{ header: "Nombre", cell: (row: Rol) => nombreVisible(row.nombre) }]}
                rows={roles}
                onRowClick={(row: Rol) => navigate(`/roles/${row.id}`)}
                empty={
                    <EmptyState
                        icon="tag"
                        title="Todavía no hay roles"
                        description="Cargá los roles con los que trabajan las personas de tus libros para poder asignarlos."
                    />
                }
            />
        </Card>
    );
}
