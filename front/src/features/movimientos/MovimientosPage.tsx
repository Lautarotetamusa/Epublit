import { useNavigate } from "react-router-dom";
import { Badge, Button, Card, EmptyState, Pagination, Table } from "../../design-system";
import type { Movimiento } from "../../api/deposito";
import { useClientes } from "../clientes/useClientes";
import { useDepositos } from "../depositos/useDepositos";
import { ExtremoDisplay } from "./ExtremoDisplay";
import { MovimientoFiltros } from "./MovimientoFiltros";
import { formatearFecha, resumirLibros, TIPO_MOVIMIENTO } from "./movimientoFormato";
import { useMovimientos } from "./useMovimientos";
import { useMovimientosFiltros } from "./useMovimientosFiltros";

// Historial de movimientos del usuario. El alta vive en `/movimientos/nuevo` y
// el detalle en `/movimientos/:id`; acá sólo se consulta.
export function MovimientosPage() {
    const { depositos } = useDepositos();
    const { clientes } = useClientes();
    const filtros = useMovimientosFiltros();
    const { movimientos, page, setPage, total, totalPaginas, loading } = useMovimientos(filtros.filtros);
    const navigate = useNavigate();

    return (
        <Card
            title="Historial de movimientos"
            subtitle="Del más reciente al más antiguo."
            actions={
                <Button iconStart="plus" onClick={() => navigate("/movimientos/nuevo")}>
                    Nuevo movimiento
                </Button>
            }
            padded={false}
        >
            <MovimientoFiltros
                filtros={filtros.filtros}
                depositos={depositos}
                clientes={clientes}
                onTipoChange={filtros.setTipo}
                onDepositoChange={filtros.setDepositoId}
                onClienteChange={filtros.setClienteId}
                onDesdeChange={filtros.setDesde}
                onHastaChange={filtros.setHasta}
                onLimpiar={filtros.limpiar}
                hayFiltrosActivos={filtros.hayFiltrosActivos}
            />
            <Table
                columns={[
                    { header: "Fecha", cell: (row: Movimiento) => formatearFecha(row.fecha) },
                    {
                        header: "Movimiento",
                        cell: (row: Movimiento) => {
                            const meta = TIPO_MOVIMIENTO[row.tipo];
                            return (
                                <Badge tone={meta.tono} icon={meta.icono}>
                                    {meta.label}
                                </Badge>
                            );
                        }
                    },
                    { header: "Origen", cell: (row: Movimiento) => <ExtremoDisplay extremo={row.origen} /> },
                    { header: "Destino", cell: (row: Movimiento) => <ExtremoDisplay extremo={row.destino} /> },
                    { header: "Libros", cell: (row: Movimiento) => resumirLibros(row.libros), muted: true }
                ]}
                rows={movimientos}
                onRowClick={(row: Movimiento) => navigate(`/movimientos/${row.id}`)}
                empty={
                    loading ? (
                        "Cargando..."
                    ) : filtros.hayFiltrosActivos ? (
                        <EmptyState
                            icon="search"
                            title="Ningún movimiento coincide con los filtros"
                            description="Probá ajustar o limpiar los filtros."
                        />
                    ) : (
                        <EmptyState
                            icon="package"
                            title="Todavía no hay movimientos"
                            description="Cargá stock con un ingreso desde el exterior, o pasá libros de un depósito a otro."
                        />
                    )
                }
            />
            {total > 0 ? (
                <div style={{ padding: "var(--space-4)" }}>
                    <Pagination page={page} pageCount={totalPaginas} total={total} onChange={setPage} />
                </div>
            ) : null}
        </Card>
    );
}
