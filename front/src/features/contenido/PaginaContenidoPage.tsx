import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    Alert,
    Badge,
    Breadcrumb,
    Button,
    Card,
    Checkbox,
    EmptyState,
    Field,
    Icon,
    IconButton,
    Input,
    Textarea
} from "../../design-system";
import { FullscreenSpinner } from "../../components/FullscreenSpinner";
import { useConfirm } from "../../notifications/ConfirmProvider";
import { useToast } from "../../notifications/ToastProvider";
import { formatFechaHora } from "../../lib/fecha";
import { sanitizeInteger } from "../../lib/numericInput";
import { AgregarBloque } from "./AgregarBloque";
import { BloqueCard } from "./BloqueCard";
import { CamposImagen } from "./CamposImagen";
import { PrevisualizacionPagina } from "./PrevisualizacionPagina";
import { useEditorPagina } from "./useEditorPagina";
import type { RequisitoPublicacion, TipoBloque } from "./tipos";
import type { ApiErrorDetalle } from "../../api/client";

type Accion = "guardar" | "publicar" | "despublicar" | "eliminar" | null;

export function PaginaContenidoPage() {
    const { id = "" } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const confirm = useConfirm();
    const {
        esNueva,
        pagina,
        loading,
        noEncontrada,
        errorCarga,
        recargar,
        dirty,
        guardando,
        subidasPendientes,
        puedeGuardar,
        puedePublicar,
        requisitos,
        errorSlug,
        verificandoSlug,
        erroresCampo,
        detallesPublicacion,
        cambiarTitulo,
        cambiarSlug,
        cambiarDescripcion,
        cambiarVisibleEnMenu,
        cambiarOrden,
        cambiarPortada,
        agregarBloque,
        actualizarBloque,
        moverBloque,
        eliminarBloque,
        guardar,
        publicar,
        despublicar,
        eliminar
    } = useEditorPagina(id);

    const [accion, setAccion] = useState<Accion>(null);
    const [verPreview, setVerPreview] = useState(false);
    const [arrastrando, setArrastrando] = useState<number | null>(null);
    const [sobre, setSobre] = useState<number | null>(null);

    if (loading) return <FullscreenSpinner />;

    if (errorCarga) {
        return (
            <Card>
                <Alert tone="error" title="No pudimos cargar la página">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", flexWrap: "wrap" }}>
                        <span>{errorCarga}</span>
                        <Button size="sm" variant="secondary" onClick={recargar}>
                            Reintentar
                        </Button>
                    </div>
                </Alert>
            </Card>
        );
    }

    if (noEncontrada || !pagina) {
        return (
            <Card>
                <EmptyState
                    icon="file-text"
                    title="No encontramos esta página"
                    description="Puede que la hayas eliminado, o que el enlace esté mal."
                    action={<Button onClick={() => navigate("/contenido")}>Volver a contenido</Button>}
                />
            </Card>
        );
    }

    const publicada = pagina.estado === "publicada";
    const errorSlugVisible = erroresCampo.slug ?? (dirty ? errorSlug : undefined);
    const errorTitulo = erroresCampo.titulo ?? (dirty && pagina.titulo.trim() === "" ? "El título es obligatorio para guardar." : undefined);
    const errorDescripcion =
        erroresCampo.descripcion ?? (dirty && pagina.descripcion.trim() === "" ? "La descripción es obligatoria para publicar." : undefined);
    const tituloVisible = pagina.titulo.trim() || (esNueva ? "Página nueva" : "Página sin título");

    const salir = async () => {
        if (dirty) {
            const ok = await confirm({
                title: "¿Salir sin guardar?",
                description: "Hay cambios que todavía no guardaste en esta página.",
                confirmLabel: "Salir sin guardar",
                tone: "danger"
            });
            if (!ok) return;
        }
        navigate("/contenido");
    };

    const ejecutar = async (tipo: Accion, fn: () => Promise<unknown>) => {
        setAccion(tipo);
        try {
            await fn();
        } finally {
            setAccion(null);
        }
    };

    const handleGuardar = async () => {
        if (!puedeGuardar) {
            showToast(
                "warning",
                subidasPendientes
                    ? "Esperá a que terminen de subir las imágenes."
                    : "Poné un título y revisá el slug antes de guardar."
            );
            return;
        }

        await ejecutar("guardar", async () => {
            const guardada = await guardar();
            if (!guardada) return;
            showToast("success", publicada ? "Cambios guardados." : "Borrador guardado.");
            if (esNueva) navigate(`/contenido/${guardada.id}`, { replace: true });
        });
    };

    const handlePublicar = async () => {
        if (!puedePublicar) {
            showToast(
                "warning",
                subidasPendientes
                    ? "Esperá a que terminen de subir las imágenes."
                    : "Revisá los puntos de publicación antes de publicar."
            );
            return;
        }

        await ejecutar("publicar", async () => {
            const publicadaGuardada = await publicar();
            if (!publicadaGuardada) return;
            showToast("success", "Página publicada.");
            if (esNueva) navigate(`/contenido/${publicadaGuardada.id}`, { replace: true });
        });
    };

    const handleDespublicar = async () => {
        if (dirty && !puedeGuardar) {
            showToast("warning", "Antes de despublicar, resolvé los campos marcados en el formulario.");
            return;
        }

        const ok = await confirm({
            title: `¿Despublicar «${tituloVisible}»?`,
            description: "La página deja de mostrarse en la landing. El contenido se guarda como borrador.",
            confirmLabel: "Despublicar"
        });
        if (!ok) return;
        await ejecutar("despublicar", async () => {
            const despublicada = await despublicar();
            if (despublicada) showToast("success", "La página quedó como borrador.");
        });
    };

    const handleEliminar = async () => {
        const ok = await confirm({
            title: `¿Eliminar «${tituloVisible}»?`,
            description:
                "La página deja de aparecer en el panel y en la landing. Se conservan sus bloques e imágenes, y el slug queda libre. No se puede deshacer.",
            confirmLabel: "Eliminar página",
            tone: "danger"
        });
        if (!ok) return;

        let eliminada = false;
        await ejecutar("eliminar", async () => {
            eliminada = await eliminar();
            if (eliminada) showToast("success", "La página se eliminó.");
        });
        if (eliminada) navigate("/contenido");
    };

    const handleAgregarBloque = (tipo: TipoBloque) => {
        const idNuevo = agregarBloque(tipo);
        requestAnimationFrame(() => {
            document.getElementById(`bloque-${idNuevo}`)?.scrollIntoView({ block: "center" });
        });
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
            <Breadcrumb
                items={["Contenido", tituloVisible]}
                onNavigate={(_item, indice) => {
                    if (indice === 0) salir();
                }}
            />

            <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "var(--space-4)", flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                        <h1
                            style={{
                                margin: 0,
                                fontFamily: "var(--font-display)",
                                fontSize: "var(--text-lg)",
                                fontWeight: "var(--weight-semibold)",
                                letterSpacing: "var(--tracking-tight)",
                                overflow: "hidden",
                                textOverflow: "ellipsis"
                            }}
                        >
                            {tituloVisible}
                        </h1>
                        <Badge tone={publicada ? "success" : "warning"} dot>
                            {publicada ? "Publicada" : "Borrador"}
                        </Badge>
                        {dirty ? <Badge tone="warning">Cambios sin guardar</Badge> : null}
                    </div>
                    <p style={{ margin: "var(--space-1) 0 0", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                        <span style={{ fontFamily: "var(--font-mono)" }}>/{pagina.slug || "sin-slug"}</span> · Última edición {formatFechaHora(pagina.actualizadaEn)}
                    </p>
                    {dirty ? (
                        <p style={{ margin: "var(--space-1) 0 0", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                            Hay cambios sin guardar. La landing sigue mostrando la última versión guardada.
                        </p>
                    ) : null}
                    {subidasPendientes ? (
                        <p style={{ margin: "var(--space-1) 0 0", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                            Subiendo imágenes. Guardar y publicar se habilitan cuando terminen.
                        </p>
                    ) : null}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                    <Button variant="secondary" iconStart="eye" onClick={() => setVerPreview(true)}>
                        Previsualizar
                    </Button>
                    {publicada ? (
                        <Button
                            variant="secondary"
                            iconStart="eye-off"
                            onClick={handleDespublicar}
                            loading={accion === "despublicar"}
                            disabled={guardando && accion !== "despublicar"}
                        >
                            Despublicar
                        </Button>
                    ) : null}
                    <Button
                        variant={publicada ? "primary" : "secondary"}
                        iconStart="save"
                        onClick={handleGuardar}
                        loading={accion === "guardar"}
                        disabled={!puedeGuardar || (guardando && accion !== "guardar")}
                    >
                        {publicada ? "Guardar cambios" : "Guardar borrador"}
                    </Button>
                    {!publicada ? (
                        <Button
                            iconStart="check"
                            onClick={handlePublicar}
                            loading={accion === "publicar"}
                            disabled={!puedePublicar || (guardando && accion !== "publicar")}
                        >
                            Publicar
                        </Button>
                    ) : null}
                    {!esNueva ? (
                        <IconButton
                            type="button"
                            variant="ghost"
                            icon="trash-2"
                            label={`Eliminar «${tituloVisible}»`}
                            onClick={handleEliminar}
                            disabled={guardando}
                        />
                    ) : null}
                </div>
            </header>

            {/* Los requisitos van en una franja compacta arriba de todo; el
                contenido sigue en orden de lectura: Datos → Portada → Bloques. */}
            <RequisitosPublicacion
                requisitos={requisitos}
                puedePublicar={puedePublicar}
                publicada={publicada}
                detalles={detallesPublicacion}
            />

            <Card title="Datos de la página" subtitle="El título y la dirección con los que se encuentra la página.">
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)" }}>
                        <Field
                            label="Título"
                            required
                            style={{ flex: "3 1 340px" }}
                            error={errorTitulo}
                        >
                            <Input
                                value={pagina.titulo}
                                invalid={Boolean(errorTitulo)}
                                onChange={(event) => cambiarTitulo(event.target.value)}
                                placeholder="Ej.: Editorial"
                            />
                        </Field>

                        <Field
                            label="Slug"
                            required
                            style={{ flex: "1 1 220px" }}
                            error={errorSlugVisible}
                            hint={
                                <span>
                                    Dirección en la landing:{" "}
                                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>/{pagina.slug || "…"}</span>
                                    {verificandoSlug ? " · Verificando disponibilidad…" : null}
                                </span>
                            }
                        >
                            <Input
                                mono
                                value={pagina.slug}
                                invalid={Boolean(errorSlugVisible)}
                                onChange={(event) => cambiarSlug(event.target.value)}
                                placeholder="editorial"
                            />
                        </Field>
                    </div>

                    <Field
                        label="Descripción para buscadores"
                        required
                        error={errorDescripcion}
                        hint={`${pagina.descripcion.length} caracteres. Se usa en buscadores y al compartir el link; entre 120 y 160 se leen mejor.`}
                    >
                        <Textarea
                            rows={3}
                            invalid={Boolean(errorDescripcion)}
                            value={pagina.descripcion}
                            onChange={(event) => cambiarDescripcion(event.target.value)}
                            placeholder="Contá en una o dos frases qué va a encontrar alguien en esta página."
                        />
                    </Field>

                    <div
                        style={{
                            borderTop: "1px solid var(--border-subtle)",
                            paddingTop: "var(--space-4)",
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "flex-start",
                            gap: "var(--space-4)"
                        }}
                    >
                        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
                            <div style={{ marginBottom: "var(--space-2)", fontSize: "var(--text-sm)", fontWeight: "var(--weight-semibold)", color: "var(--text-body)" }}>
                                Menú del sitio
                            </div>
                            <Checkbox
                                label="Visible en el menú del sitio"
                                checked={pagina.visibleEnMenu}
                                onChange={(event) => cambiarVisibleEnMenu(event.target.checked)}
                            />
                            <p style={{ margin: "var(--space-1) 0 0 var(--space-6)", fontSize: "var(--text-2xs)", color: "var(--text-muted)" }}>
                                Si la ocultás, la página sigue existiendo en su dirección pero no aparece en la navegación. Una página en borrador no se muestra hasta publicarla.
                            </p>
                        </div>
                        <Field
                            label="Orden en el menú"
                            hint="Menor número, antes en la navegación."
                            style={{ flex: "0 1 200px" }}
                        >
                            <Input
                                inputMode="numeric"
                                value={String(pagina.orden)}
                                onChange={(event) => {
                                    const limpio = sanitizeInteger(event.target.value);
                                    cambiarOrden(limpio === "" ? 1 : Math.min(99, Math.max(1, Number(limpio))));
                                }}
                            />
                        </Field>
                    </div>
                </div>
            </Card>

            <Card title="Portada de la página" subtitle="La imagen que representa la página en el menú y al compartirla.">
                <CamposImagen
                    imagen={pagina.portada}
                    onChange={cambiarPortada}
                    uso="portada"
                    label="portada"
                    minWidthPx={1200}
                    minHeightPx={600}
                />
            </Card>

            <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "var(--space-3)", flexWrap: "wrap" }}>
                    <div>
                        <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-md)", fontWeight: "var(--weight-semibold)", letterSpacing: "var(--tracking-tight)" }}>
                            Bloques
                        </h2>
                        <p style={{ margin: "4px 0 0", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                            El orden de acá es el orden en que se leen en la landing. Arrastrá un bloque o usá las flechas.
                        </p>
                    </div>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                        {pagina.bloques.length} {pagina.bloques.length === 1 ? "bloque" : "bloques"}
                    </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                    {pagina.bloques.map((bloque, indice) => (
                        <BloqueCard
                            key={bloque.id}
                            bloque={bloque}
                            indice={indice}
                            total={pagina.bloques.length}
                            arrastrando={arrastrando === indice}
                            sobre={sobre === indice && arrastrando !== null && arrastrando !== indice}
                            onChange={(patch) => actualizarBloque(bloque.id, patch)}
                            onMover={moverBloque}
                            onEliminar={eliminarBloque}
                            onDragStart={() => setArrastrando(indice)}
                            onDragEnd={() => {
                                setArrastrando(null);
                                setSobre(null);
                            }}
                            onDragEnter={() => setSobre(indice)}
                            onDrop={() => {
                                if (arrastrando !== null) moverBloque(arrastrando, indice);
                                setArrastrando(null);
                                setSobre(null);
                            }}
                        />
                    ))}
                </div>

                <AgregarBloque onAgregar={handleAgregarBloque} />
            </section>

            {verPreview ? <PrevisualizacionPagina pagina={pagina} open onClose={() => setVerPreview(false)} /> : null}
        </div>
    );
}

type RequisitosPublicacionProps = {
    requisitos: RequisitoPublicacion[];
    puedePublicar: boolean;
    publicada: boolean;
    detalles: ApiErrorDetalle[];
};

// El checklist no vive en una tarjeta: es una franja fina de ancho completo
// que se lee antes de empezar a editar. Si falta algo, el conteo lo dice sin
// obligar a abrir nada. Cuando el backend rechaza la publicación, sus detalles
// exactos se listan acá abajo: es el lugar donde la editora ya busca el motivo.
function RequisitosPublicacion({ requisitos, puedePublicar, publicada, detalles }: RequisitosPublicacionProps) {
    const faltantes = requisitos.filter((requisito) => !requisito.ok).length;

    return (
        <section
            aria-label="Requisitos de publicación"
            style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-2)",
                padding: "var(--space-3) var(--space-4)",
                background: "var(--papel-50)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)"
            }}
        >
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--space-2)", flexWrap: "wrap" }}>
                <span style={{ fontSize: "var(--text-xs)", fontWeight: "var(--weight-semibold)", color: "var(--text-body)" }}>
                    Requisitos de publicación
                </span>
                <span
                    role="status"
                    style={{
                        fontSize: "var(--text-xs)",
                        fontWeight: "var(--weight-semibold)",
                        color: puedePublicar ? "var(--text-success)" : "var(--text-body)"
                    }}
                >
                    {puedePublicar
                        ? publicada
                            ? "La página cumple todos los requisitos."
                            : "Todo listo para publicar."
                        : `Faltan ${faltantes} ${faltantes === 1 ? "requisito" : "requisitos"}.`}
                </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                {requisitos.map((requisito) => (
                    <div key={requisito.label} style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-2)" }}>
                        <Icon
                            name={requisito.ok ? "circle-check" : "circle-alert"}
                            size={14}
                            color={requisito.ok ? "var(--text-success)" : "var(--text-warning)"}
                            style={{ marginTop: 1 }}
                        />
                        <span style={{ fontSize: "var(--text-xs)", color: requisito.ok ? "var(--text-muted)" : "var(--text-body)", lineHeight: "var(--leading-normal)" }}>
                            {requisito.label}
                        </span>
                    </div>
                ))}
            </div>
            {detalles.length > 0 ? (
                <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--space-2)", display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                    <span style={{ fontSize: "var(--text-xs)", fontWeight: "var(--weight-semibold)", color: "var(--text-body)" }}>
                        El servidor encontró estos puntos pendientes
                    </span>
                    {detalles.map((detalle, indice) => (
                        <div key={`${detalle.campo}-${indice}`} style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-2)" }}>
                            <Icon name="circle-alert" size={14} color="var(--text-warning)" style={{ marginTop: 1 }} />
                            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-body)", lineHeight: "var(--leading-normal)" }}>
                                {detalle.mensaje}
                                {detalle.campo ? (
                                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}> · {detalle.campo}</span>
                                ) : null}
                            </span>
                        </div>
                    ))}
                </div>
            ) : null}
        </section>
    );
}
