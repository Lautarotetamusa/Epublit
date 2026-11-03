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
    edadMin: string;
    edadMax: string;
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

type GrupoProps = {
    values: LibroFormValues;
    onChange: (patch: Partial<LibroFormValues>) => void;
};

type Props = GrupoProps & {
    colecciones: Coleccion[];
    // El ISBN sólo se puede cargar al crear el libro: una vez creado es su
    // identificador (ver back/src/modules/libro/libro.routes.ts, la ficha
    // navega por isbn), así que en la edición no tiene sentido mostrarlo acá.
    isbnEditable?: boolean;
};

// Los campos se agrupan por lo que significan para el libro, no por el orden en
// que se cargan: identificación, ficha editorial y medidas de envío. La ficha
// los reparte en tarjetas y el alta los apila, sin duplicar inputs.
export function PortadaLibroFields({ values, onChange }: GrupoProps) {
    const portadaPreview = useFilePreview(values.portadaFile, values.portadaUrl);

    return (
        <Field label="Portada">
            <CoverUpload
                value={portadaPreview}
                onSelect={(file) => onChange({ portadaFile: file, portadaUrl: "" })}
                onRemove={() => onChange({ portadaFile: null, portadaUrl: "" })}
            />
        </Field>
    );
}

export function DatosLibroFields({ values, onChange, colecciones }: GrupoProps & { colecciones: Coleccion[] }) {
    return (
        <>
            {/* Título y colección van juntos: la colección es un atributo de
                catálogo del libro, no un detalle del final (ver
                specs/007-colecciones/design.md). */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "var(--space-4)" }}>
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
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "var(--space-4)",
                    marginTop: "var(--space-4)"
                }}
            >
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
            <Field
                label="Stock negativo permitido"
                style={{ marginTop: "var(--space-4)" }}
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
        </>
    );
}

export function FichaLibroFields({ values, onChange }: GrupoProps) {
    const bookTrailerInvalid = values.bookTrailerUrl !== "" && !isValidYoutubeUrl(values.bookTrailerUrl);

    return (
        <>
            <Field label="Brief" hint="Resumen breve del libro para catálogo y ficha.">
                <Textarea rows={4} value={values.brief} onChange={(e) => onChange({ brief: e.target.value })} />
            </Field>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                    gap: "var(--space-4)",
                    marginTop: "var(--space-4)"
                }}
            >
                <Field label="Cantidad de páginas">
                    <Input
                        type="text"
                        inputMode="numeric"
                        value={values.paginas}
                        onChange={(e) => onChange({ paginas: sanitizeInteger(e.target.value) })}
                    />
                </Field>
                <Field label="Edad desde" hint="Vacío = sin mínimo. Ej: 0">
                    <Input
                        type="text"
                        inputMode="numeric"
                        suffix="años"
                        value={values.edadMin}
                        onChange={(e) => onChange({ edadMin: sanitizeInteger(e.target.value) })}
                    />
                </Field>
                <Field label="Edad hasta" hint="Vacío = sin máximo. Ej: 3">
                    <Input
                        type="text"
                        inputMode="numeric"
                        suffix="años"
                        value={values.edadMax}
                        onChange={(e) => onChange({ edadMax: sanitizeInteger(e.target.value) })}
                    />
                </Field>
            </div>
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
        </>
    );
}

export function MedidasLibroFields({ values, onChange }: GrupoProps) {
    const pesoInvalido = values.pesoKg !== "" && (!Number.isFinite(Number(values.pesoKg)) || Number(values.pesoKg) <= 0);

    return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "var(--space-4)" }}>
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
    );
}

// Alta de libro: los tres grupos apilados en una sola tarjeta.
export function LibroFormFields({ values, onChange, colecciones, isbnEditable }: Props) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
            {isbnEditable ? (
                <Field label="ISBN" required>
                    <Input value={values.isbn} maxLength={13} onChange={(e) => onChange({ isbn: e.target.value })} />
                </Field>
            ) : null}
            <DatosLibroFields values={values} onChange={onChange} colecciones={colecciones} />
            <FichaLibroFields values={values} onChange={onChange} />
            <MedidasLibroFields values={values} onChange={onChange} />
            <PortadaLibroFields values={values} onChange={onChange} />
        </div>
    );
}
