import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Table, Pagination, Button, IconButton, EmptyState, Avatar, Field, Select } from "../../design-system";
import type { Persona } from "../../api/persona";
import { usePersonas } from "./usePersonas";
import { useRoles } from "../roles/useRoles";
import { nombreVisible, opcionesDeRol } from "../roles/presentacionRol";
import { useToast } from "../../notifications/ToastProvider";
import { useConfirm } from "../../notifications/ConfirmProvider";
import { getErrorMessage } from "../../lib/errors";

export function PersonasPage() {
    const { roles } = useRoles();
    // El filtro es por el rol de la cuenta (plan 011): "todos" simplemente no
    // manda el filtro.
    const [idRol, setIdRol] = useState<number | "">("");
    const rolFiltrado = roles.find((rol) => rol.id === idRol) ?? null;
    const { personas, pagination, page, setPage, loading, remove } = usePersonas(rolFiltrado);
    const { showToast } = useToast();
    const confirm = useConfirm();
    const navigate = useNavigate();

    const pageCount = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize)) : 1;

    const handleDelete = async (id: number, nombre: string) => {
        const ok = await confirm({
            title: `¿Eliminar a ${nombre}?`,
            description: "Esta acción no se puede deshacer.",
            confirmLabel: "Eliminar",
            tone: "danger"
        });
        if (!ok) return;

        try {
            await remove(id);
            showToast("success", "Persona eliminada correctamente");
        } catch (err) {
            showToast("error", getErrorMessage(err));
        }
    };

    return (
        <Card
            title="Personas"
            actions={
                <Button iconStart="plus" onClick={() => navigate("/personas/nuevo")}>
                    Nueva persona
                </Button>
            }
            padded={false}
        >
            <div style={{ padding: "var(--space-4)", borderBottom: "1px solid var(--border-subtle)" }}>
                <Field label="Rol" style={{ maxWidth: 420 }}>
                    <Select
                        value={idRol === "" ? "" : String(idRol)}
                        onChange={(e) => setIdRol(e.target.value === "" ? "" : Number(e.target.value))}
                        options={opcionesDeRol(roles)}
                        placeholder="Todos los roles"
                    />
                </Field>
            </div>
            <Table
                columns={[
                    {
                        header: "",
                        width: 40,
                        cell: (row: Persona) =>
                            row.fotoUrl ? (
                                <div
                                    style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: "var(--radius-pill)",
                                        overflow: "hidden",
                                        boxShadow: "var(--shadow-xs)"
                                    }}
                                >
                                    <img src={row.fotoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                </div>
                            ) : (
                                <Avatar name={row.nombre} size="sm" />
                            )
                    },
                    { header: "Nombre", key: "nombre" },
                    { header: "Email", key: "email", muted: true },
                    { header: "DNI", key: "dni", mono: true },
                    {
                        header: "",
                        align: "right",
                        cell: (row) => (
                            <IconButton
                                icon="trash-2"
                                label={`Eliminar a ${row.nombre}`}
                                variant="ghost"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(row.id, row.nombre);
                                }}
                            />
                        )
                    }
                ]}
                rows={personas}
                onRowClick={(row: Persona) => navigate(`/personas/${row.id}`)}
                empty={
                    loading ? (
                        "Cargando..."
                    ) : rolFiltrado ? (
                        <EmptyState
                            icon="users"
                            title={`Todavía no hay personas con el rol «${nombreVisible(rolFiltrado.nombre)}»`}
                            description="Cuando le asignes ese rol a alguien en un libro, aparece acá."
                        />
                    ) : (
                        <EmptyState icon="users" title="Todavía no hay personas" description="Cargá la primera persona con el botón de arriba." />
                    )
                }
            />
            {pagination && pagination.total > 0 ? (
                <div style={{ padding: "var(--space-4)" }}>
                    <Pagination page={page} pageCount={pageCount} total={pagination.total} onChange={setPage} />
                </div>
            ) : null}
        </Card>
    );
}
