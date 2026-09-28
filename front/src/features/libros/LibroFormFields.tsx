import { Field, Input, Textarea, CoverUpload } from "../../design-system";
import { sanitizeDecimal, sanitizeInteger } from "../../lib/numericInput";
import { isValidYoutubeUrl } from "../../lib/validation";
import { useFilePreview } from "../../lib/useFilePreview";

export type LibroFormValues = {
    isbn: string;
    titulo: string;
    fecha_edicion: string;
    precio: string;
    stock: string;
    alto: string;
    ancho: string;
    largo: string;
    brief: string;
    paginas: string;
    edad_recomendada: string;
    // URL ya subida (libro existente) o vacío si todavía no tiene portada.
    portadaUrl: string;
    // Archivo elegido en esta sesión, pendiente de subir al guardar (ver
    // "Datos necesarios" en specs/003-libro-campos-extendidos/design.md).
    portadaFile: File | null;
    bookTrailerUrl: string;
};

type Props = {
    values: LibroFormValues;
    onChange: (patch: Partial<LibroFormValues>) => void;
    // El ISBN sólo se puede cargar al crear el libro: una vez creado es su
    // identificador (ver back/src/modules/libro/libro.routes.ts, la ficha
    // navega por isbn), así que en la edición no tiene sentido mostrarlo acá.
    isbnEditable?: boolean;
};

// Campos compartidos por la ficha de libro (edición) y el alta de libro
// nuevo: mismos inputs, misma sanitización numérica, sólo cambia si el ISBN
// se puede tocar.
export function LibroFormFields({ values, onChange, isbnEditable }: Props) {
    const portadaPreview = useFilePreview(values.portadaFile, values.portadaUrl);
    const bookTrailerInvalid = values.bookTrailerUrl !== "" && !isValidYoutubeUrl(values.bookTrailerUrl);

    return (
        <>
            {isbnEditable ? (
                <Field label="ISBN" required>
                    <Input value={values.isbn} maxLength={13} onChange={(e) => onChange({ isbn: e.target.value })} />
                </Field>
            ) : null}
            <Field label="Título" style={isbnEditable ? { marginTop: "var(--space-4)" } : undefined}>
                <Input value={values.titulo} onChange={(e) => onChange({ titulo: e.target.value })} />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-4)", marginTop: "var(--space-4)" }}>
                <Field label="Fecha de edición">
                    <Input type="date" value={values.fecha_edicion} onChange={(e) => onChange({ fecha_edicion: e.target.value })} />
                </Field>
                <Field label="Precio">
                    <Input
                        type="text"
                        inputMode="decimal"
                        suffix="ARS"
                        value={values.precio}
                        onChange={(e) => onChange({ precio: sanitizeDecimal(e.target.value) })}
                    />
                </Field>
                <Field label="Stock">
                    <Input
                        type="text"
                        inputMode="numeric"
                        value={values.stock}
                        onChange={(e) => onChange({ stock: sanitizeInteger(e.target.value) })}
                    />
                </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-4)", marginTop: "var(--space-4)" }}>
                <Field label="Alto">
                    <Input
                        type="text"
                        inputMode="decimal"
                        suffix="cm"
                        value={values.alto}
                        onChange={(e) => onChange({ alto: sanitizeDecimal(e.target.value) })}
                    />
                </Field>
                <Field label="Ancho">
                    <Input
                        type="text"
                        inputMode="decimal"
                        suffix="cm"
                        value={values.ancho}
                        onChange={(e) => onChange({ ancho: sanitizeDecimal(e.target.value) })}
                    />
                </Field>
                <Field label="Largo">
                    <Input
                        type="text"
                        inputMode="decimal"
                        suffix="cm"
                        value={values.largo}
                        onChange={(e) => onChange({ largo: sanitizeDecimal(e.target.value) })}
                    />
                </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginTop: "var(--space-4)" }}>
                <Field label="Cantidad de páginas">
                    <Input
                        type="text"
                        inputMode="numeric"
                        value={values.paginas}
                        onChange={(e) => onChange({ paginas: sanitizeInteger(e.target.value) })}
                    />
                </Field>
                <Field label="Edad recomendada" hint='Se muestra como "+10 años"'>
                    <Input
                        type="text"
                        inputMode="numeric"
                        suffix="años"
                        value={values.edad_recomendada}
                        onChange={(e) => onChange({ edad_recomendada: sanitizeInteger(e.target.value) })}
                    />
                </Field>
            </div>

            <Field label="Brief" style={{ marginTop: "var(--space-4)" }} hint="Resumen breve del libro para catálogo y ficha.">
                <Textarea rows={4} value={values.brief} onChange={(e) => onChange({ brief: e.target.value })} />
            </Field>

            <Field
                label="Book trailer"
                style={{ marginTop: "var(--space-4)" }}
                hint="Opcional. Link de YouTube."
                error={bookTrailerInvalid ? "Tiene que ser un link de YouTube válido." : undefined}
            >
                <Input
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    invalid={bookTrailerInvalid}
                    value={values.bookTrailerUrl}
                    onChange={(e) => onChange({ bookTrailerUrl: e.target.value })}
                />
            </Field>

            <Field label="Portada" style={{ marginTop: "var(--space-4)" }}>
                <CoverUpload
                    value={portadaPreview}
                    onSelect={(file) => onChange({ portadaFile: file, portadaUrl: "" })}
                    onRemove={() => onChange({ portadaFile: null, portadaUrl: "" })}
                />
            </Field>
        </>
    );
}
