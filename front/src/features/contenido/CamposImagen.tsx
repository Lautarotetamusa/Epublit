import { useState } from "react";
import type { UsoImagen } from "../../api/contenido";
import { Field, MediaUpload, Textarea, Input } from "../../design-system";
import { useToast } from "../../notifications/ToastProvider";
import { imagenDesdeArchivo } from "./tipos";
import type { ImagenContenido } from "./tipos";
import { useSubidaImagen } from "./useSubidaImagen";

type CamposImagenProps = {
    imagen: ImagenContenido | null;
    onChange: (imagen: ImagenContenido | null) => void;
    /** Destino de la imagen: define la resolución mínima en el backend. */
    uso: UsoImagen;
    label?: string;
    compact?: boolean;
    /** Marcador y campos lado a lado cuando el contenedor lo permite. */
    horizontal?: boolean;
    minWidthPx?: number;
    minHeightPx?: number;
};

const MAX_SIZE_MB = 8;

// Imagen + sus dos campos de accesibilidad/lectura. El alt es obligatorio
// cuando hay imagen: la landing lo necesita para lectores de pantalla y para
// el caso en que la imagen no cargue. El epígrafe es opcional y se muestra
// debajo en la página. La subida es real: mientras el archivo viaja se ve el
// objectURL local y, si falla, se vuelve a la imagen anterior sin perder el
// alt/epígrafe que ya estaban escritos.
export function CamposImagen({
    imagen,
    onChange,
    uso,
    label = "imagen",
    compact = false,
    horizontal = false,
    minWidthPx = 1000,
    minHeightPx = 400
}: CamposImagenProps) {
    const { showToast } = useToast();
    const { subiendo, subir } = useSubidaImagen();
    const [errorSubida, setErrorSubida] = useState<string | null>(null);

    const handleSelect = async (file: File) => {
        const anterior = imagen;
        const preview = imagenDesdeArchivo(file, anterior, uso);
        onChange(preview);
        setErrorSubida(null);

        const subida = await subir(file, uso);
        if (!subida) {
            onChange(anterior);
            setErrorSubida("No se pudo subir esta imagen. Probá de nuevo.");
            return;
        }

        onChange({
            ...preview,
            imagenId: subida.imagenId,
            url: subida.url,
            ancho: subida.ancho,
            alto: subida.alto,
            subiendo: false
        });
    };

    const handleAlt = (alt: string) => {
        if (imagen) onChange({ ...imagen, alt });
    };

    const handleEpigrafe = (epigrafe: string) => {
        if (imagen) onChange({ ...imagen, epigrafe });
    };

    return (
        <div
            style={{
                display: "flex",
                flexDirection: horizontal ? "row" : "column",
                flexWrap: "wrap",
                alignItems: "flex-start",
                gap: "var(--space-4)"
            }}
        >
            <MediaUpload
                value={imagen?.url || undefined}
                onSelect={handleSelect}
                onRemove={() => onChange(null)}
                onRejected={(mensaje) => showToast("warning", mensaje)}
                maxSizeMb={MAX_SIZE_MB}
                minWidthPx={minWidthPx}
                minHeightPx={minHeightPx}
                compact={compact}
                label={label}
                invalid={Boolean(imagen && imagen.alt.trim() === "")}
                disabled={subiendo}
                hint={subiendo ? "Subiendo imagen…" : undefined}
            />
            {imagen ? (
                <div
                    style={{
                        flex: horizontal ? "1 1 380px" : undefined,
                        minWidth: horizontal ? 260 : undefined,
                        width: horizontal ? undefined : "100%",
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: "var(--space-3)"
                    }}
                >
                    <Field
                        label="Texto alternativo"
                        required
                        hint="Describí qué se ve. Se lee en lectores de pantalla."
                        error={imagen.alt.trim() === "" ? "Sin texto alternativo, la imagen no se puede publicar." : undefined}
                    >
                        <Input
                            value={imagen.alt}
                            invalid={imagen.alt.trim() === ""}
                            onChange={(e) => handleAlt(e.target.value)}
                            placeholder="Ej.: taller de encuadernación con libros apilados"
                        />
                    </Field>
                    <Field label="Epígrafe" hint="Se muestra debajo de la imagen. Opcional.">
                        <Textarea rows={2} value={imagen.epigrafe} onChange={(e) => handleEpigrafe(e.target.value)} />
                    </Field>
                </div>
            ) : (
                <p style={{ margin: 0, flex: horizontal ? "1 1 300px" : undefined, width: horizontal ? undefined : "100%", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                    Sin imagen. La página se puede publicar igual; la portada y el hero se ven mejor con una.
                </p>
            )}
            {errorSubida ? (
                <p style={{ margin: 0, flexBasis: "100%", fontSize: "var(--text-xs)", color: "var(--text-error)" }}>
                    {errorSubida}
                </p>
            ) : null}
        </div>
    );
}
