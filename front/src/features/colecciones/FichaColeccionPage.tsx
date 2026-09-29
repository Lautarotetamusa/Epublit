import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Alert, Breadcrumb, Button, Card, CoverUpload, Field } from "../../design-system";
import type { Coleccion, UpdateColeccionInput } from "../../api/coleccion";
import { FullscreenSpinner } from "../../components/FullscreenSpinner";
import { useToast } from "../../notifications/ToastProvider";
import { useConfirm } from "../../notifications/ConfirmProvider";
import { getErrorMessage } from "../../lib/errors";
import { useFilePreview } from "../../lib/useFilePreview";
import { useFichaColeccion } from "./useFichaColeccion";
import { useLibrosDeColeccion } from "./useLibrosDeColeccion";
import { asignarLibrosAColeccion } from "./buscarLibros";
import { quitarLibroDeColeccion } from "./librosDeColeccion";
import { LibrosDeColeccionSection } from "./LibrosDeColeccionSection";
import { ColeccionFormFields, isColeccionFormValid } from "./ColeccionFormFields";
import type { ColeccionFormValues } from "./ColeccionFormFields";

export function FichaColeccionPage() {
    const { id = "" } = useParams();
    const idColeccion = Number(id);
    const { coleccion, loading, update, remove, refetch } = useFichaColeccion(idColeccion);
    const { libros, loading: loadingLibros, refetch: refetchLibros } = useLibrosDeColeccion(idColeccion);
    const { showToast } = useToast();
    const confirm = useConfirm();
    const navigate = useNavigate();

    if (loading || !coleccion) return <FullscreenSpinner />;

    const tieneLibros = coleccion.cantidad_libros > 0;

    const handleEliminar = async () => {
        const ok = await confirm({
            title: `¿Eliminar «${coleccion.titulo}»?`,
            description: "Esta acción no se puede deshacer.",
            confirmLabel: "Eliminar",
            tone: "danger"
        });
        if (!ok) return;

        try {
            await remove();
            showToast("success", "Colección eliminada correctamente");
            navigate("/colecciones");
        } catch (err) {
            showToast("error", getErrorMessage(err));
        }
    };

    // Después de cada cambio de pertenencia hay que releer las dos cosas: la
    // colección (la cantidad de libros de la cabecera sale de ahí) y la tabla
    // de libros de la colección.
    const handleAgregar = async (isbns: string[]) => {
        await asignarLibrosAColeccion(idColeccion, isbns);
        await Promise.all([refetch(), refetchLibros()]);
    };

    const handleQuitar = async (isbn: string) => {
        await quitarLibroDeColeccion(isbn);
        await Promise.all([refetch(), refetchLibros()]);
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Breadcrumb
                items={["Colecciones", coleccion.titulo]}
                onNavigate={(_item, index) => index === 0 && navigate("/colecciones")}
            />

            <EdicionColeccionForm
                coleccion={coleccion}
                onSave={async (input, portadaFile, quitarPortada) => {
                    try {
                        await update(input, portadaFile, quitarPortada);
                        showToast("success", "Colección actualizada correctamente");
                    } catch (err) {
                        showToast("error", getErrorMessage(err));
                    }
                }}
            />

            <LibrosDeColeccionSection
                libros={libros}
                loading={loadingLibros}
                onAgregar={handleAgregar}
                onQuitar={handleQuitar}
                onAbrirLibro={(isbn) => navigate(`/libros/${isbn}`)}
            />

            <Card title="Eliminar colección">
                {tieneLibros ? (
                    <Alert tone="warning" title="Todavía tiene libros">
                        Para eliminar «{coleccion.titulo}» primero sacá {coleccion.cantidad_libros === 1 ? "su único libro" : `sus ${coleccion.cantidad_libros} libros`} de
                        la colección, o cambialos de colección desde la ficha de cada libro.
                    </Alert>
                ) : (
                    <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                        Se elimina la colección, no los libros: los títulos siguen en el catálogo, sin colección.
                    </p>
                )}
                <Button variant="danger" style={{ marginTop: "var(--space-4)" }} disabled={tieneLibros} onClick={handleEliminar}>
                    Eliminar colección
                </Button>
            </Card>
        </div>
    );
}

function EdicionColeccionForm({
    coleccion,
    onSave
}: {
    coleccion: Coleccion;
    onSave: (input: UpdateColeccionInput, portadaFile: File | null, quitarPortada: boolean) => Promise<void>;
}) {
    const [inputs, setInputs] = useState<ColeccionFormValues>({
        titulo: coleccion.titulo,
        descripcion: coleccion.descripcion ?? ""
    });
    const [portadaFile, setPortadaFile] = useState<File | null>(null);
    // "Quitar" no sólo limpia el archivo elegido: el preview caería a
    // `coleccion.portada_url` y la portada vieja no se podría sacar. La baja
    // se confirma con "Guardar cambios", como los demás campos del formulario.
    const [quitarPortada, setQuitarPortada] = useState(false);
    const portadaPreview = useFilePreview(portadaFile, quitarPortada ? "" : coleccion.portada_url ?? "");
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setSaving(true);
        await onSave({ titulo: inputs.titulo, descripcion: inputs.descripcion || null }, portadaFile, quitarPortada);
        // Con la colección recién releída, el preview sale de `portada_url`:
        // el archivo local y la marca de "quitar" ya no hacen falta.
        setPortadaFile(null);
        setQuitarPortada(false);
        setSaving(false);
    };

    return (
        <Card title={coleccion.titulo} subtitle="Portada, título y descripción.">
            <form onSubmit={handleSubmit}>
                <Field label="Portada">
                    <CoverUpload
                        value={portadaPreview || undefined}
                        onSelect={(file) => {
                            setPortadaFile(file);
                            setQuitarPortada(false);
                        }}
                        onRemove={() => {
                            setPortadaFile(null);
                            setQuitarPortada(true);
                        }}
                    />
                </Field>
                <div style={{ marginTop: "var(--space-4)" }}>
                    <ColeccionFormFields values={inputs} onChange={(patch) => setInputs((current) => ({ ...current, ...patch }))} />
                </div>
                <Button type="submit" style={{ marginTop: "var(--space-4)" }} loading={saving} disabled={!isColeccionFormValid(inputs)}>
                    Guardar cambios
                </Button>
            </form>
        </Card>
    );
}
