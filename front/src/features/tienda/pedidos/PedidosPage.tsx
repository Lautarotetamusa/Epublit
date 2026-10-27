import { useNavigate } from "react-router-dom";
import { Alert, Badge, Button, Card, EmptyState, Pagination, Table } from "../../../design-system";
import { usePedidos, PEDIDOS_POR_PAGINA } from "./usePedidos";
import { usePedidosFiltros } from "./usePedidosFiltros";
import { PedidosFiltros } from "./PedidosFiltros";
import { EstadoPagoBadge, EstadoPedidoBadge, FormaEntregaCelda } from "./PedidoBadges";
import { articulosLabel } from "./tipos";
import type { Pedido } from "./tipos";
import { formatFecha } from "../../../lib/fecha";
import { formatMoney } from "../../../lib/money";

export function PedidosPage() {
    const filtros = usePedidosFiltros();
    const { pedidos, conteos, total, loading, error, refetch } = usePedidos(filtros.filtros, filtros.pagina);
    const navigate = useNavigate();
    const pageCount = Math.max(1, Math.ceil(total / PEDIDOS_POR_PAGINA));

    return (
        <Card
            title="Pedidos"
            subtitle="Los pedidos de la tienda online, desde el pago hasta la entrega."
            actions={
                <>
                    <Badge tone="accent" icon="store">
                        Tienda online
                    </Badge>
                    <Button variant="secondary" iconStart="settings" onClick={() => navigate("/tienda")}>
                        Configurar tienda
                    </Button>
                </>
            }
            padded={false}
        >
            {error ? (
                <div style={{ padding: "var(--space-5)" }}>
                    <Alert tone="error" title="No pudimos cargar los pedidos">
                        {error}
                        <div style={{ marginTop: "var(--space-3)" }}>
                            <Button variant="secondary" size="sm" iconStart="arrow-right" onClick={refetch}>
                                Reintentar
                            </Button>
                        </div>
                    </Alert>
                </div>
            ) : (
                <>
                    <PedidosFiltros
                        filtros={filtros.filtros}
                        conteos={conteos}
                        onEstadoChange={filtros.setEstado}
                        onBusquedaChange={filtros.setBusqueda}
                        onDesdeChange={filtros.setDesde}
                        onHastaChange={filtros.setHasta}
                        onEntregaChange={filtros.setEntrega}
                        onLimpiar={filtros.limpiar}
                        hayFiltrosActivos={filtros.hayFiltrosActivos}
                    />
                    <Table
                        columns={[
                            {
                                header: "Pedido",
                                cell: (row: Pedido) => (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                        <span
                                            style={{
                                                fontFamily: "var(--font-mono)",
                                                fontSize: "var(--text-xs)",
                                                fontWeight: "var(--weight-semibold)"
                                            }}
                                        >
                                            {row.codigo}
                                        </span>
                                        <span style={{ fontSize: "var(--text-2xs)", color: "var(--text-subtle)" }}>
                                            {articulosLabel(row.cantidadItems)}
                                        </span>
                                    </div>
                                )
                            },
                            {
                                header: "Fecha",
                                cell: (row: Pedido) => formatFecha(row.fecha)
                            },
                            {
                                header: "Comprador",
                                cell: (row: Pedido) => (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                                        <span style={{ fontWeight: "var(--weight-medium)" }}>{row.comprador.nombre}</span>
                                        <a
                                            href={`mailto:${row.comprador.email}`}
                                            onClick={(e) => e.stopPropagation()}
                                            style={{
                                                fontSize: "var(--text-2xs)",
                                                color: "var(--text-muted)",
                                                textDecoration: "none"
                                            }}
                                        >
                                            {row.comprador.email}
                                        </a>
                                        {row.comprador.telefono ? (
                                            <a
                                                href={`tel:${row.comprador.telefono}`}
                                                onClick={(e) => e.stopPropagation()}
                                                style={{
                                                    fontSize: "var(--text-2xs)",
                                                    color: "var(--text-subtle)",
                                                    textDecoration: "none"
                                                }}
                                            >
                                                {row.comprador.telefono}
                                            </a>
                                        ) : null}
                                    </div>
                                )
                            },
                            {
                                header: "Total",
                                align: "right",
                                mono: true,
                                cell: (row: Pedido) => formatMoney(row.total)
                            },
                            {
                                header: "Pago",
                                cell: (row: Pedido) => <EstadoPagoBadge estado={row.estadoPago} />
                            },
                            {
                                header: "Entrega",
                                cell: (row: Pedido) => <FormaEntregaCelda forma={row.entrega} />
                            },
                            {
                                header: "Estado",
                                cell: (row: Pedido) => <EstadoPedidoBadge estado={row.estado} />
                            }
                        ]}
                        rows={loading ? [] : pedidos}
                        onRowClick={(row: Pedido) => navigate(`/pedidos/${row.codigo}`)}
                        empty={
                            loading ? (
                                "Cargando pedidos…"
                            ) : filtros.hayFiltrosActivos ? (
                                <EmptyState
                                    icon="search"
                                    title="Ningún pedido coincide con los filtros"
                                    description="Probá con otro estado, otro rango de fechas o limpiá la búsqueda."
                                    action={
                                        <Button variant="secondary" iconStart="x" onClick={filtros.limpiar}>
                                            Limpiar filtros
                                        </Button>
                                    }
                                />
                            ) : (
                                <EmptyState
                                    icon="store"
                                    title="Todavía no hay pedidos"
                                    description="Cuando alguien compre en tu tienda online, el pedido aparece acá con los datos del comprador y el pago."
                                    action={
                                        <Button variant="secondary" iconStart="settings" onClick={() => navigate("/tienda")}>
                                            Configurar la tienda
                                        </Button>
                                    }
                                />
                            )
                        }
                    />
                    {!loading && total > 0 ? (
                        <div style={{ padding: "var(--space-4) var(--space-5)" }}>
                            <Pagination
                                page={filtros.pagina}
                                pageCount={pageCount}
                                total={total}
                                onChange={filtros.setPagina}
                            />
                        </div>
                    ) : null}
                </>
            )}
        </Card>
    );
}
