import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Table, Pagination, Input, Button, EmptyState } from "../../design-system";
import type { Libro } from "../../api/libro";
import { useLibros } from "./useLibros";

export function CatalogoPage() {
    const { libros, pagination, page, setPage, titulo, setTitulo, loading } = useLibros();
    const navigate = useNavigate();
    const [selected, setSelected] = useState<Set<string | number>>(new Set());

    const pageCount = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize)) : 1;

    return (
        <Card
            title="Libros"
            actions={
                <>
                    {selected.size > 0 ? (
                        <Button
                            variant="secondary"
                            iconStart="receipt-text"
                            onClick={() => navigate(`/ventas/nueva?isbns=${[...selected].join(",")}`)}
                        >
                            Nueva venta ({selected.size})
                        </Button>
                    ) : null}
                    <Button iconStart="plus" onClick={() => navigate("/libros/nuevo")}>
                        Nuevo libro
                    </Button>
                </>
            }
            padded={false}
        >
            <div style={{ padding: "var(--space-4)" }}>
                <Input iconStart="search" placeholder="Buscar por título..." value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </div>
            <Table
                selectable
                selectedKeys={selected}
                onSelectionChange={setSelected}
                rowKey={(l: Libro) => l.isbn}
                columns={[
                    {
                        header: "",
                        cell: (row: Libro) => (
                            <div
                                style={{
                                    width: 32,
                                    height: 44,
                                    borderRadius: "var(--radius-sm)",
                                    overflow: "hidden",
                                    background: "var(--pino-800)",
                                    boxShadow: "var(--shadow-xs)"
                                }}
                            >
                                {row.portada_url ? (
                                    <img
                                        src={row.portada_url}
                                        alt=""
                                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                    />
                                ) : null}
                            </div>
                        )
                    },
                    { header: "Título", key: "titulo" },
                    { header: "ISBN", key: "isbn", mono: true },
                    { header: "Precio", align: "right", cell: (row: Libro) => row.precio.toLocaleString("es-AR") },
                    { header: "Stock", key: "stock", align: "right" },
                    { header: "Edición", cell: (row: Libro) => new Date(row.fecha_edicion).toLocaleDateString("es-AR") }
                ]}
                rows={libros}
                onRowClick={(row: Libro) => navigate(`/libros/${row.isbn}`)}
                empty={
                    loading ? (
                        "Cargando..."
                    ) : (
                        <EmptyState icon="library" title="Todavía no hay libros" description="Cargá el primer título con el botón de arriba." />
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
