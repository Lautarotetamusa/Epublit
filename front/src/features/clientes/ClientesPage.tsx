import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Table, Pagination, Button, Input, IconButton, Badge, EmptyState } from "../../design-system";
import type { Cliente } from "../../api/cliente";
import { useClientes } from "./useClientes";
import { useClientPagination } from "../../lib/useClientPagination";
import { useToast } from "../../notifications/ToastProvider";
import { useConfirm } from "../../notifications/ConfirmProvider";
import { getErrorMessage } from "../../lib/errors";
import { TIPO_CLIENTE_LABEL, tipoClienteBadgeTone } from "./tipoCliente";

export function ClientesPage() {
    const { clientes, loading, remove } = useClientes();
    const confirm = useConfirm();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const [filterText, setFilterText] = useState("");
    const filtered = clientes.filter((c) => c.nombre.toLowerCase().includes(filterText.toLowerCase()));
    const { page, setPage, pageCount, pageItems, total } = useClientPagination(filtered);

    const handleDelete = async (cliente: Cliente) => {
        const ok = await confirm({
            title: `¿Eliminar a ${cliente.nombre}?`,
            description: "Sólo se puede eliminar un cliente sin ventas ni consignaciones asociadas.",
            confirmLabel: "Eliminar",
            tone: "danger"
        });
        if (!ok) return;

        try {
            await remove(cliente.id);
            showToast("success", "Cliente eliminado correctamente");
        } catch (err) {
            showToast("error", getErrorMessage(err));
        }
    };

    return (
        <Card
            title="Clientes"
            actions={
                <Button iconStart="plus" onClick={() => navigate("/clientes/nuevo")}>
                    Nuevo cliente
                </Button>
            }
            padded={false}
        >
            <div style={{ padding: "var(--space-4)" }}>
                <Input
                    iconStart="search"
                    placeholder="Buscar por nombre..."
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                />
            </div>
            <Table
                columns={[
                    { header: "Nombre", key: "nombre" },
                    { header: "Email", key: "email", muted: true },
                    { header: "CUIT", key: "cuit", mono: true },
                    {
                        header: "Tipo",
                        cell: (row) => <Badge tone={tipoClienteBadgeTone(row.tipo)}>{TIPO_CLIENTE_LABEL[row.tipo ?? ""] ?? "-"}</Badge>
                    },
                    {
                        header: "",
                        align: "right",
                        cell: (row) => (
                            <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                                <IconButton
                                    icon="receipt-text"
                                    label={`Venta en firme para ${row.nombre}`}
                                    variant="ghost"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/ventas/nueva?clienteId=${row.id}&tipoVenta=firme`);
                                    }}
                                />
                                <IconButton
                                    icon="trash-2"
                                    label={`Eliminar a ${row.nombre}`}
                                    variant="ghost"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(row);
                                    }}
                                />
                            </div>
                        )
                    }
                ]}
                rows={pageItems}
                onRowClick={(row: Cliente) => navigate(`/clientes/${row.id}`)}
                empty={
                    loading ? (
                        "Cargando..."
                    ) : (
                        <EmptyState icon="store" title="Todavía no hay clientes" description="Creá tu primer cliente con el botón de arriba." />
                    )
                }
            />
            {total > 0 ? (
                <div style={{ padding: "var(--space-4)" }}>
                    <Pagination page={page} pageCount={pageCount} total={total} onChange={setPage} />
                </div>
            ) : null}
        </Card>
    );
}
