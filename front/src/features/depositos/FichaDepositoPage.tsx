import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Alert, Badge, Breadcrumb, Button, Card, EmptyState, Table } from "../../design-system";
import type { LibroEnMovimiento } from "../../api/deposito";
import { deleteDeposito, updateDeposito } from "../../api/deposito";
import { ApiError } from "../../api/client";
import { FullscreenSpinner } from "../../components/FullscreenSpinner";
import { useConfirm } from "../../notifications/ConfirmProvider";
import { useToast } from "../../notifications/ToastProvider";
import { getErrorMessage } from "../../lib/errors";
import type { DepositoFormValues } from "./DepositoFormFields";
import { DepositoFormFields, isDepositoFormValid } from "./DepositoFormFields";
import { useDeposito } from "./useDepositos";

// Ficha de un depósito: sus datos, el stock que tiene adentro y las reglas de
// borrado. El borrado vive acá y no en el listado porque hace falta lugar para
// explicar por qué está bloqueado (mismo criterio que las colecciones).
export function FichaDepositoPage() {
    const { id = "" } = useParams();
    const idDeposito = Number(id);
    const { deposito, libros, ejemplares, loading, refetch } = useDeposito(idDeposito);
    const { showToast } = useToast();
    const confirm = useConfirm();
    const navigate = useNavigate();

    if (loading) return <FullscreenSpinner />;

    if (!deposito) {
        return (
            <Card>
                <EmptyState
                    icon="building-2"
                    title="El depósito no existe"
                    description="Puede que lo hayas eliminado, o que el enlace esté mal."
                    action={<Button onClick={() => navigate("/depositos")}>Volver a depósitos</Button>}
                />
            </Card>
        );
    }

    const handleGuardar = async (input: { nombre: string; descripcion: string }) => {
        try {
            await updateDeposito(deposito.id, { nombre: input.nombre, descripcion: input.descripcion.trim() ? input.descripcion : null });
            refetch();
            showToast("success", "Depósito actualizado correctamente");
        } catch (err) {
            showToast("error", getErrorMessage(err));
        }
    };

    const handleEliminar = async () => {
        const ok = await confirm({
            title: `¿Eliminar «${deposito.nombre}»?`,
            description: "El depósito está vacío, así que se elimina sin tocar los libros del catálogo.",
            confirmLabel: "Eliminar",
            tone: "danger"
        });
        if (!ok) return;

        try {
            await deleteDeposito(deposito.id);
            showToast("success", "Depósito eliminado correctamente");
            navigate("/depositos");
        } catch (err) {
            // El motivo real de un rechazo lo define el backend (principal o con
            // stock): la pantalla muestra el que devuelva, no uno propio. Si el
            // rechazo fue por stock, además se refresca la ficha para que el
            // aviso muestre las cifras reales (pudieron cambiar desde la última
            // lectura).
            if (err instanceof ApiError && err.errors.some((e) => e.code === "DepositoConStock")) refetch();
            showToast("error", getErrorMessage(err));
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Breadcrumb items={["Depósitos", deposito.nombre]} onNavigate={(_item, index) => index === 0 && navigate("/depositos")} />

            <EdicionDepositoForm key={deposito.id} nombre={deposito.nombre} descripcion={deposito.descripcion} principal={deposito.principal} onGuardar={handleGuardar} />

            <Card
                title="Stock del depósito"
                subtitle="Los libros que están acá, con su cantidad."
                padded={false}
                actions={
                    <Button
                        variant="secondary"
                        size="sm"
                        iconStart="arrow-right"
                        onClick={() => navigate(`/movimientos/nuevo?tipo=transferencia&origen=${deposito.id}`)}
                    >
                        Registrar movimiento
                    </Button>
                }
            >
                <div style={{ padding: "var(--space-5)" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)" }}>
                        <span
                            style={{
                                fontFamily: "var(--font-display)",
                                fontSize: "var(--text-2xl)",
                                fontWeight: "var(--weight-semibold)",
                                fontVariantNumeric: "tabular-nums"
                            }}
                        >
                            {ejemplares.toLocaleString("es-AR")}
                        </span>
                        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                            ejemplares · {libros.length === 1 ? "1 título" : `${libros.length} títulos`}
                        </span>
                    </div>
                </div>
                <Table
                    columns={[
                        { header: "Título", key: "titulo" },
                        { header: "ISBN", key: "isbn", mono: true, muted: true },
                        { header: "Cantidad", key: "cantidad", align: "right", mono: true }
                    ]}
                    rows={libros}
                    onRowClick={(row: LibroEnMovimiento) => navigate(`/libros/${row.isbn}`)}
                    empty={
                        <EmptyState
                            icon="boxes"
                            title="Todavía no hay stock acá"
                            description="Cargá ejemplares con un ingreso desde el exterior, o pasalos desde otro depósito."
                            action={
                                <Button
                                    iconStart="plus"
                                    onClick={() => navigate(`/movimientos/nuevo?tipo=ingreso&destino=${deposito.id}`)}
                                >
                                    Registrar ingreso
                                </Button>
                            }
                        />
                    }
                />
            </Card>

            <Card title="Eliminar depósito">
                {deposito.principal ? (
                    <Alert tone="info" title="El depósito principal no se puede eliminar">
                        Es el depósito con el que se creó tu cuenta y existe siempre. Podés cambiarle el nombre, pero no borrarlo.
                    </Alert>
                ) : ejemplares > 0 ? (
                    <Alert tone="warning" title="Todavía tiene stock">
                        «{deposito.nombre}» tiene {ejemplares.toLocaleString("es-AR")} ejemplares en {libros.length === 1 ? "1 título" : `${libros.length} títulos`}. Pasalos
                        a otro depósito antes de eliminarlo.
                    </Alert>
                ) : (
                    <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                        El depósito no tiene stock, así que se puede eliminar. Los libros del catálogo no se tocan.
                    </p>
                )}
                <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)", flexWrap: "wrap" }}>
                    <Button variant="danger" disabled={deposito.principal || ejemplares > 0} onClick={handleEliminar}>
                        Eliminar depósito
                    </Button>
                    {!deposito.principal && ejemplares > 0 ? (
                        <Button
                            variant="secondary"
                            iconStart="arrow-right"
                            onClick={() => navigate(`/movimientos/nuevo?tipo=transferencia&origen=${deposito.id}`)}
                        >
                            Mover este stock
                        </Button>
                    ) : null}
                </div>
            </Card>
        </div>
    );
}

function EdicionDepositoForm({
    nombre,
    descripcion,
    principal,
    onGuardar
}: {
    nombre: string;
    descripcion: string | null;
    principal: boolean;
    onGuardar: (input: { nombre: string; descripcion: string }) => Promise<void>;
}) {
    const [values, setValues] = useState<DepositoFormValues>({ nombre, descripcion: descripcion ?? "" });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setSaving(true);
        await onGuardar({ nombre: values.nombre, descripcion: values.descripcion });
        setSaving(false);
    };

    return (
        <Card
            title={
                <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-3)" }}>
                    {nombre}
                    {principal ? (
                        <Badge tone="brand" dot>
                            Principal
                        </Badge>
                    ) : null}
                </span>
            }
            subtitle="Nombre y descripción del depósito."
        >
            <form onSubmit={handleSubmit}>
                <DepositoFormFields values={values} onChange={(patch) => setValues((actual) => ({ ...actual, ...patch }))} />
                <Button type="submit" style={{ marginTop: "var(--space-4)" }} loading={saving} disabled={!isDepositoFormValid(values)}>
                    Guardar cambios
                </Button>
            </form>
        </Card>
    );
}
