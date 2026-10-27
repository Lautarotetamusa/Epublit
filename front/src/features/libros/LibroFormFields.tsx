import { Field, Input, Textarea, CoverUpload, Select } from "../../design-system";
import type { Coleccion } from "../../api/coleccion";
import { sanitizeDecimal, sanitizeInteger } from "../../lib/numericInput";
import { isValidYoutubeUrl } from "../../lib/validation";
import { useFilePreview } from "../../lib/useFilePreview";

export type LibroFormValues = {
    isbn: string;
    titulo: string;
    fecha_edicion: string;
    precio: string;
    alto: string;
    ancho: string;
    largo: string;
    // Peso en kg para que PAQ.AR cotice; vacío = peso promedio de la cuenta.
    // El campo no lleva hint a propósito (ver specs/016-tienda-ecommerce).
    pesoKg: string;
    brief: string;
    paginas: string;
    edad_recomendada: string;
    // URL ya subida (libro existente) o vacío si todavía no tiene portada.
    portadaUrl: string;
    // Archivo elegido en esta sesión, pendiente de subir al guardar (ver
    // "Datos necesarios" en specs/003-libro-campos-extendidos/design.md).
    portadaFile: File | null;
    bookTrailerUrl: string;
    // Colección a la que pertenece el libro, como string para que el Select
    // pueda usar "" como "Sin colección". Un libro está en una colección o en
    // ninguna (ver specs/006-colecciones).
    idColeccion: string;
    // Stock que la tienda online puede vender de más cuando el depósito
    // principal llega a cero.
    stockNegativoPermitido: string;
};

type Props = {
    values: LibroFormValues;
    onChange: (patch: Partial<LibroFormValues>) => void;
    colecciones: Coleccion[];
    // El ISBN sólo se puede cargar al crear el libro: una vez creado es su
    // identificador (ver back/src/modules/libro/libro.routes.ts, la ficha
    // navega por isbn), así que en la edición no tiene sentido mostrarlo acá.
    isbnEditable?: boolean;
};

// Campos compartidos por la ficha de libro (edición) y el alta de libro
// nuevo: mismos inputs, misma sanitización numérica, sólo cambia si el ISBN
// se puede tocar.
export function LibroFormFields({ values, onChange, colecciones, isbnEditable }: Props) {
    const portadaPreview = useFilePreview(values.portadaFile, values.portadaUrl);
    const bookTrailerInvalid = values.bookTrailerUrl !== "" && !isValidYoutubeUrl(values.bookTrailerUrl);
    const pesoInvalido = values.pesoKg !== "" && (!Number.isFinite(Number(values.pesoKg)) || Number(values.pesoKg) <= 0);

    return (
        <>
            {isbnEditable ? (
                <Field label="ISBN" required>
                    <Input value={values.isbn} maxLength={13} onChange={(e) => onChange({ isbn: e.target.value })} />
                </Field>
            ) : null}
            {/* Título y colección van juntos arriba de todo: la colección es un
                atributo de catálogo del libro, no un detalle del final. Antes
                quedaba entre el brief y el book trailer y pasaba
                desapercibida (ver specs/007-colecciones/design.md). */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr",
                    gap: "var(--space-4)",
                    marginTop: isbnEditable ? "var(--space-4)" : undefined
                }}
            >
                <Field label="Título">
                    <Input value={values.titulo} onChange={(e) => onChange({ titulo: e.target.value })} />
                </Field>
                <Field label="Colección" hint="Una colección o ninguna. Podés cambiarla cuando quieras.">
                    <Select
                        value={values.idColeccion}
                        placeholder="Sin colección"
                        onChange={(e) => onChange({ idColeccion: e.target.value })}
                        options={colecciones.map((coleccion) => ({ value: String(coleccion.id), label: coleccion.titulo }))}
                    />
                </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginTop: "var(--space-4)" }}>
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
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                    gap: "var(--space-4)",
                    marginTop: "var(--space-4)"
                }}
            >
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
                <Field label="Peso" error={pesoInvalido ? "El peso tiene que ser mayor a 0." : undefined}>
                    <Input
                        type="text"
                        inputMode="decimal"
                        suffix="kg"
                        invalid={pesoInvalido}
                        value={values.pesoKg}
                        onChange={(e) => onChange({ pesoKg: sanitizeDecimal(e.target.value) })}
                    />
                </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-4)", marginTop: "var(--space-4)" }}>
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
                <Field
                    label="Stock negativo permitido"
                    hint="Ejemplares que la tienda online puede vender de más si el stock del depósito principal llega a cero. 0 = no permitir."
                >
                    <Input
                        type="text"
                        inputMode="numeric"
                        suffix="ej."
                        value={values.stockNegativoPermitido}
                        onChange={(e) => onChange({ stockNegativoPermitido: sanitizeInteger(e.target.value) })}
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
