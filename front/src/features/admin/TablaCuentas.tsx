import { useState } from "react";
import { Badge, Button, Card, EmptyState, Field, Icon, Input, Pagination, Select, Table } from "../../design-system";
import { downloadCsv } from "../../lib/csv";
import { formatFecha, formatFechaRelativa } from "../../lib/fecha";
import { formatEntero } from "../../lib/numero";
import { useMediaQuery } from "../../lib/useMediaQuery";
import { useToast } from "../../notifications/ToastProvider";
import type { UsuarioAdmin } from "./tipos";
import { useTablaCuentas } from "./useTablaCuentas";
import type { FiltroArca, FiltroEstado } from "./useTablaCuentas";

const OPCIONES_ESTADO = [
    { value: "todos", label: "Todos" },
    { value: "activos", label: "Activos" },
    { value: "inactivos", label: "Inactivos" }
];

const OPCIONES_ARCA = [
    { value: "todos", label: "Todos" },
    { value: "con-arca", label: "Con ARCA" },
    { value: "sin-arca", label: "Sin ARCA" }
];

function numero(valor: number) {
    if (valor === 0) return <span style={{ color: "var(--text-subtle)" }}>0</span>;
    return formatEntero(valor);
}

function SiNo({ activo, icono }: { activo: boolean; icono: string }) {
    if (!activo) return <span style={{ color: "var(--text-subtle)" }}>No</span>;

    return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--pino-700)" }}>
            <Icon name={icono} size={14} />
            Sí
        </span>
    );
}

function CargandoCuentas() {
    return (
        <div
            role="status"
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "var(--space-3)",
                padding: "var(--space-2) 0",
                color: "var(--text-muted)"
            }}
        >
            <Icon
                name="loader-circle"
                size={24}
                color="var(--pino-600)"
                style={{ animation: "epublit-spin 900ms linear infinite" }}
            />
            <span style={{ fontSize: "var(--text-sm)" }}>Cargando cuentas…</span>
        </div>
    );
}

// La tabla es el registro de la campaña: cada fila mezcla identidad, alta,
// actividad y volumen de trabajo. El orden lo define el backend (razón social),
// y la búsqueda, los filtros y la página se resuelven server-side.
export function TablaCuentas({ totalCuentas }: { totalCuentas: number }) {
    const {
        busqueda,
        setBusqueda,
        estado,
        setEstado,
        arca,
        setArca,
        cuentas,
        hayFiltros,
        limpiar,
        page,
        setPage,
        pageCount,
        total,
        loading,
        error,
        recargar,
        listarTodas
    } = useTablaCuentas();

    const compacto = useMediaQuery("(max-width: 1100px)");
    const { showToast } = useToast();
    const [exportando, setExportando] = useState(false);

    async function exportarCsv() {
        setExportando(true);
        try {
            // El recorte filtrado completo, no sólo la página visible.
            const todas = await listarTodas();

            const encabezados = [
                "Razón social",
                "Email",
                "Alta",
                "ARCA conectado",
                "Última operación",
                "Operaciones 30d",
                "Libros",
                "Ventas 30d",
                "Estado"
            ];

            const filas = todas.map((usuario) => [
                usuario.razonSocial,
                usuario.email,
                usuario.fechaAlta ? formatFecha(usuario.fechaAlta) : "Sin fecha",
                usuario.arcaConectado ? "Sí" : "No",
                usuario.ultimaOperacion ? formatFecha(usuario.ultimaOperacion) : "Sin operaciones",
                usuario.operaciones30d,
                usuario.libros,
                usuario.ventas30d,
                usuario.estado === "activo" ? "Activo" : "Inactivo"
            ]);

            downloadCsv(
                `cuentas-epublit-${new Date().toISOString().slice(0, 10)}.csv`,
                encabezados,
                filas
            );
        } catch {
            showToast("error", "No pudimos exportar el listado. Probá de nuevo.");
        } finally {
            setExportando(false);
        }
    }

    return (
        <Card
            title="Cuentas"
            subtitle={`${formatEntero(totalCuentas)} cuentas`}
            actions={
                <Button
                    variant="secondary"
                    iconStart="download"
                    disabled={total === 0 || exportando}
                    onClick={exportarCsv}
                >
                    {exportando ? "Exportando…" : "Exportar CSV"}
                </Button>
            }
            padded={false}
            footer={
                pageCount > 1 ? (
                    <Pagination
                        page={page}
                        pageCount={pageCount}
                        total={total}
                        itemLabel="cuentas"
                        onChange={setPage}
                    />
                ) : undefined
            }
        >
            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "flex-end",
                    gap: "var(--space-3)",
                    padding: "var(--space-3) var(--space-5)",
                    borderBottom: "1px solid var(--border-subtle)"
                }}
            >
                <Field label="Buscar cuenta" style={{ flex: "1 1 240px", maxWidth: 320 }}>
                    <Input
                        iconStart="search"
                        placeholder="Razón social o email"
                        value={busqueda}
                        onChange={(event) => setBusqueda(event.target.value)}
                    />
                </Field>
                <Field label="Estado" style={{ width: 130 }}>
                    <Select
                        options={OPCIONES_ESTADO}
                        value={estado}
                        onChange={(event) => setEstado(event.target.value as FiltroEstado)}
                    />
                </Field>
                <Field label="ARCA" style={{ width: 140 }}>
                    <Select
                        options={OPCIONES_ARCA}
                        value={arca}
                        onChange={(event) => setArca(event.target.value as FiltroArca)}
                    />
                </Field>
                <div style={{ flex: 1 }} />
                {hayFiltros ? (
                    <span
                        style={{
                            fontSize: "var(--text-xs)",
                            color: "var(--text-muted)",
                            paddingBottom: "var(--space-2)"
                        }}
                    >
                        {formatEntero(total)} de {formatEntero(totalCuentas)} cuentas
                    </span>
                ) : null}
            </div>

            {compacto ? (
                <div
                    style={{
                        padding: "var(--space-2) var(--space-5) 0",
                        fontSize: "var(--text-2xs)",
                        color: "var(--text-muted)"
                    }}
                >
                    Deslizá la tabla para ver todas las columnas.
                </div>
            ) : null}

            <Table
                rows={cuentas}
                rowKey={(usuario: UsuarioAdmin) => usuario.id}
                columns={[
                    {
                        header: "Cuenta",
                        width: 270,
                        cell: (usuario: UsuarioAdmin) => (
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 2,
                                    maxWidth: 270,
                                    overflow: "hidden"
                                }}
                            >
                                <span
                                    title={usuario.razonSocial}
                                    style={{
                                        fontWeight: "var(--weight-medium)",
                                        color: "var(--text-body)",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis"
                                    }}
                                >
                                    {usuario.razonSocial}
                                </span>
                                <span
                                    title={usuario.email}
                                    style={{
                                        fontSize: "var(--text-2xs)",
                                        color: "var(--text-muted)",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis"
                                    }}
                                >
                                    {usuario.email}
                                </span>
                            </div>
                        )
                    },
                    {
                        header: "Alta",
                        width: 104,
                        cell: (usuario: UsuarioAdmin) =>
                            usuario.fechaAlta ? (
                                formatFecha(usuario.fechaAlta)
                            ) : (
                                <span style={{ color: "var(--text-subtle)" }}>Sin fecha</span>
                            )
                    },
                    {
                        header: "ARCA",
                        width: 92,
                        cell: (usuario: UsuarioAdmin) => (
                            <SiNo activo={usuario.arcaConectado} icono="file-text" />
                        )
                    },
                    {
                        header: "Última operación",
                        width: 156,
                        cell: (usuario: UsuarioAdmin) => (
                            <div
                                title={
                                    usuario.ultimaOperacion
                                        ? `Última operación: ${formatFecha(usuario.ultimaOperacion)}`
                                        : undefined
                                }
                                style={{ display: "flex", flexDirection: "column", gap: 2 }}
                            >
                                <span
                                    style={{
                                        color: usuario.ultimaOperacion
                                            ? "var(--text-body)"
                                            : "var(--text-subtle)"
                                    }}
                                >
                                    {usuario.ultimaOperacion
                                        ? formatFechaRelativa(usuario.ultimaOperacion)
                                        : "Sin operaciones"}
                                </span>
                                <span
                                    style={{
                                        fontSize: "var(--text-2xs)",
                                        color: "var(--text-muted)"
                                    }}
                                >
                                    {usuario.ultimoLogin
                                        ? `Ingresó ${formatFechaRelativa(usuario.ultimoLogin)}`
                                        : "Nunca ingresó"}
                                </span>
                            </div>
                        )
                    },
                    {
                        header: "Operaciones 30d",
                        width: 124,
                        align: "right",
                        mono: true,
                        cell: (usuario: UsuarioAdmin) => numero(usuario.operaciones30d)
                    },
                    {
                        header: "Libros",
                        width: 80,
                        align: "right",
                        mono: true,
                        cell: (usuario: UsuarioAdmin) => numero(usuario.libros)
                    },
                    {
                        header: "Ventas 30d",
                        width: 104,
                        align: "right",
                        mono: true,
                        cell: (usuario: UsuarioAdmin) => numero(usuario.ventas30d)
                    },
                    {
                        header: "Estado",
                        width: 100,
                        cell: (usuario: UsuarioAdmin) =>
                            usuario.estado === "activo" ? (
                                <Badge tone="success" dot>
                                    Activo
                                </Badge>
                            ) : (
                                <Badge tone="neutral" dot>
                                    Inactivo
                                </Badge>
                            )
                    }
                ]}
                empty={
                    loading ? (
                        <CargandoCuentas />
                    ) : error ? (
                        <EmptyState
                            icon="triangle-alert"
                            title="No pudimos cargar las cuentas"
                            description="Revisá la conexión y volvé a intentar."
                            action={
                                <Button variant="secondary" size="sm" onClick={recargar}>
                                    Reintentar
                                </Button>
                            }
                        />
                    ) : hayFiltros ? (
                        <EmptyState
                            icon="search"
                            title="Ninguna cuenta coincide"
                            description="Probá con otra razón social o email, o quitá los filtros para ver todas las cuentas."
                            action={
                                <Button variant="secondary" size="sm" onClick={limpiar}>
                                    Limpiar filtros
                                </Button>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon="users"
                            title="Todavía no hay cuentas"
                            description="Cuando se registre la primera editorial, va a aparecer acá con su actividad."
                        />
                    )
                }
            />
        </Card>
    );
}
