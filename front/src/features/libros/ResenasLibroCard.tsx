import { useState } from "react";
import { Button, Card, Dialog, EmptyState, Field, Icon, IconButton, Input } from "../../design-system";
import type { Resena } from "../../api/libro";
import { useConfirm } from "../../notifications/ConfirmProvider";
import { useToast } from "../../notifications/ToastProvider";
import { getErrorMessage } from "../../lib/errors";
import { isValidWebUrl } from "../../lib/validation";
import { useResenasLibro } from "./useResenasLibro";

// `undefined` = diálogo cerrado; `null` = alta; una reseña = edición.
type ResenaEnEdicion = Resena | null | undefined;

export function ResenasLibroCard({ isbn }: { isbn: string }) {
    const { resenas, loading, crear, editar, borrar } = useResenasLibro(isbn);
    const [enEdicion, setEnEdicion] = useState<ResenaEnEdicion>(undefined);
    const { showToast } = useToast();
    const confirm = useConfirm();

    const guardar = async (url: string): Promise<boolean> => {
        try {
            if (enEdicion) await editar(enEdicion.id, url);
            else await crear(url);
            showToast("success", enEdicion ? "Reseña actualizada" : "Reseña agregada");
            return true;
        } catch (err) {
            showToast("error", getErrorMessage(err));
            return false;
        }
    };

    const confirmarBorrado = async (resena: Resena) => {
        const ok = await confirm({
            title: "¿Eliminar esta reseña?",
            description: "Deja de mostrarse en la tienda online.",
            confirmLabel: "Eliminar reseña",
            tone: "danger"
        });
        if (!ok) return;

        try {
            await borrar(resena.id);
            showToast("success", "Reseña eliminada");
        } catch (err) {
            showToast("error", getErrorMessage(err));
        }
    };

    return (
        <Card
            title="Reseñas"
            actions={
                <Button variant="secondary" size="sm" iconStart="plus" onClick={() => setEnEdicion(null)}>
                    Agregar reseña
                </Button>
            }
        >
            {!loading && resenas.length === 0 ? (
                <EmptyState icon="quote" title="Todavía no hay reseñas" description="Agregá el link de una reseña para mostrarla en la tienda." />
            ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "var(--space-2)" }}>
                    {resenas.map((resena) => (
                        <li key={resena.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", minWidth: 0 }}>
                            <Icon name="link" size={14} color="var(--text-muted)" />
                            <a
                                href={resena.url}
                                target="_blank"
                                rel="noreferrer"
                                style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                            >
                                {resena.url}
                            </a>
                            <IconButton icon="pencil" label="Editar reseña" size="sm" onClick={() => setEnEdicion(resena)} />
                            <IconButton icon="trash-2" label="Eliminar reseña" size="sm" onClick={() => confirmarBorrado(resena)} />
                        </li>
                    ))}
                </ul>
            )}

            {enEdicion !== undefined ? (
                <ResenaDialog resena={enEdicion} onClose={() => setEnEdicion(undefined)} onSave={guardar} />
            ) : null}
        </Card>
    );
}

function ResenaDialog({
    resena,
    onClose,
    onSave
}: {
    resena: Resena | null;
    onClose: () => void;
    onSave: (url: string) => Promise<boolean>;
}) {
    const [url, setUrl] = useState(resena?.url ?? "");
    const [saving, setSaving] = useState(false);
    const urlInvalida = url.trim() !== "" && !isValidWebUrl(url);

    const handleSave = async () => {
        setSaving(true);
        const guardada = await onSave(url);
        setSaving(false);
        if (guardada) onClose();
    };

    return (
        <Dialog
            open
            title={resena ? "Editar reseña" : "Agregar reseña"}
            onClose={onClose}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} loading={saving} disabled={url.trim() === "" || urlInvalida}>
                        Guardar
                    </Button>
                </>
            }
        >
            <Field label="Link de la reseña" error={urlInvalida ? "Tiene que ser un link que empiece con http:// o https://." : undefined}>
                <Input
                    type="url"
                    placeholder="https://…"
                    invalid={urlInvalida}
                    value={url}
                    autoFocus
                    onChange={(e) => setUrl(e.target.value)}
                />
            </Field>
        </Dialog>
    );
}
