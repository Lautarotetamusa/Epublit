import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Table, Pagination, Button, EmptyState } from "../../design-system";
import type { Venta, MedioPago } from "../../api/operaciones";
import { getMediosPago } from "../../api/operaciones";
import { useVentas } from "./useVentas";
import { useVentasFiltros } from "./useVentasFiltros";
import { VentasFiltros } from "./VentasFiltros";
import { useClientes } from "../clientes/useClientes";
import { useClientPagination } from "../../lib/useClientPagination";

export function VentasPage() {
    const { ventas, loading } = useVentas();
    const { clientes } = useClientes();
    const [mediosPago, setMediosPago] = useState<MedioPago[]>([]);
    const filtros = useVentasFiltros(ventas);
    const { page, setPage, pageCount, pageItems, total } = useClientPagination(filtros.ventasFiltradas);
    const navigate = useNavigate();

    useEffect(() => {
        getMediosPago().then(setMediosPago);
    }, []);

    return (
        <Card
            title="Ventas"
            actions={
                <Button iconStart="plus" onClick={() => navigate("/ventas/nueva")}>
                    Nueva venta
                </Button>
            }
            padded={false}
        >
            <VentasFiltros
                filtros={filtros.filtros}
                clientes={clientes}
                mediosPago={mediosPago}
                onClienteChange={filtros.setClienteId}
                onTipoChange={filtros.setTipo}
                onMedioPagoChange={filtros.setMedioPago}
                onDesdeChange={filtros.setDesde}
                onHastaChange={filtros.setHasta}
                onLimpiar={filtros.limpiar}
                hayFiltrosActivos={filtros.hayFiltrosActivos}
            />
            <Table
                columns={[
                    { header: "Tipo", cell: (row: Venta) => (row.type === "venta" ? "En firme" : "Sobre consignado") },
                    { header: "Cliente", key: "nombre_cliente" },
                    { header: "CUIT", key: "cuit", mono: true },
                    { header: "Medio de pago", key: "medio_pago" },
                    { header: "Fecha", cell: (row: Venta) => new Date(row.fecha).toLocaleDateString("es-AR") },
                    { header: "Total", align: "right", cell: (row: Venta) => row.total.toLocaleString("es-AR") }
                ]}
                rows={pageItems}
                onRowClick={(row: Venta) => navigate(`/ventas/${row.id}`)}
                empty={
                    loading ? (
                        "Cargando..."
                    ) : filtros.hayFiltrosActivos ? (
                        <EmptyState icon="search" title="Ninguna venta coincide con los filtros" description="Probá ajustar o limpiar los filtros." />
                    ) : (
                        <EmptyState icon="receipt-text" title="Todavía no hay ventas" />
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
