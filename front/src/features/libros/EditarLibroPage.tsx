import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Breadcrumb, Button, Card, EmptyState } from "../../design-system";
import type { Coleccion } from "../../api/coleccion";
import { FullscreenSpinner } from "../../components/FullscreenSpinner";
import { useToast } from "../../notifications/ToastProvider";
import { getErrorMessage } from "../../lib/errors";
import { useFichaLibro } from "./useFichaLibro";
import { PersonasLibroSection } from "./PersonasLibroSection";
import { DatosLibroFields, FichaLibroFields, MedidasLibroFields, PortadaLibroFields } from "./LibroFormFields";
import type { LibroFormValues } from "./LibroFormFields";

// Edición de la ficha: sólo los campos editables del libro y las personas.
// El stock queda afuera a propósito: se consulta y se explica en el detalle.
export function EditarLibroPage() {
    const { isbn = "" } = useParams();
    const {
        libro,
        personas,
        colecciones,
        roles,
        idColeccion,
        loading,
        error,
        update,
        agregarPersonaExistente,
        agregarPersonaNueva,
        actualizarRelacion,
        quitarPersona
    } = useFichaLibro(isbn);
    const { showToast } = useToast();
    const navigate = useNavigate();

    if (loading) return <FullscreenSpinner />;

    if (!libro) {
        return (
            <Card>
                <EmptyState
                    icon="library"
                    title="No se pudo cargar el libro"
                    description={error ?? "Puede que lo hayas eliminado, o que el enlace esté mal."}
                    action={<Button onClick={() => navigate("/libros")}>Volver a libros</Button>}
                />
            </Card>
        );
    }

    const volverAlDetalle = () => navigate(`/libros/${libro.isbn}`);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Breadcrumb
                items={["Libros", libro.titulo, "Editar"]}
                onNavigate={(_item, index) => {
                    if (index === 0) navigate("/libros");
                    if (index === 1) volverAlDetalle();
                }}
            />

            <EdicionLibroForm
                key={libro.isbn}
                libro={libro}
                colecciones={colecciones}
                idColeccion={idColeccion}
                onCancel={volverAlDetalle}
                onSave={async (input, portadaFile, idColeccionElegida) => {
                    try {
                        await update(input, portadaFile, idColeccionElegida);
                        showToast("success", "Libro actualizado correctamente");
                        volverAlDetalle();
                    } catch (err) {
                        showToast("error", getErrorMessage(err));
                    }
                }}
            />

            <PersonasLibroSection
                personasEnLibro={libro.personas}
                todasLasPersonas={personas}
                roles={roles}
                onAgregarExistente={agregarPersonaExistente}
                onAgregarNueva={agregarPersonaNueva}
                onActualizarRelacion={actualizarRelacion}
                onQuitar={quitarPersona}
            />
        </div>
    );
}

function EdicionLibroForm({
    libro,
    colecciones,
    idColeccion,
    onSave,
    onCancel
}: {
    libro: {
        isbn: string;
        titulo: string;
        precio: number;
        fecha_edicion: string;
        alto: number | null;
        ancho: number | null;
        largo: number | null;
        peso_kg: number | null;
        stock_negativo_permitido: number;
        brief: string | null;
        paginas: number | null;
        edad_min: number | null;
        edad_max: number | null;
        portada_url: string | null;
        book_trailer_url: string | null;
    };
    colecciones: Coleccion[];
    idColeccion: number | null;
    onSave: (
        input: {
            titulo: string;
            precio: number;
            fecha_edicion: string;
            alto?: number;
            ancho?: number;
            largo?: number;
            peso_kg?: number;
            stock_negativo_permitido?: number;
            brief?: string;
            paginas?: number;
            edad_min?: number | null;
            edad_max?: number | null;
            book_trailer_url?: string;
        },
        portadaFile: File | null,
        idColeccion: number | null
    ) => Promise<void>;
    onCancel: () => void;
}) {
    const [inputs, setInputs] = useState<LibroFormValues>({
        isbn: libro.isbn,
        titulo: libro.titulo,
        precio: String(libro.precio),
        fecha_edicion: libro.fecha_edicion.slice(0, 10),
        alto: libro.alto !== null ? String(libro.alto) : "",
        ancho: libro.ancho !== null ? String(libro.ancho) : "",
        largo: libro.largo !== null ? String(libro.largo) : "",
        pesoKg: libro.peso_kg !== null && libro.peso_kg !== undefined ? String(libro.peso_kg) : "",
        brief: libro.brief ?? "",
        paginas: libro.paginas !== null ? String(libro.paginas) : "",
        edadMin: libro.edad_min !== null ? String(libro.edad_min) : "",
        edadMax: libro.edad_max !== null ? String(libro.edad_max) : "",
        portadaUrl: libro.portada_url ?? "",
        portadaFile: null,
        bookTrailerUrl: libro.book_trailer_url ?? "",
        idColeccion: idColeccion !== null ? String(idColeccion) : "",
        stockNegativoPermitido: String(libro.stock_negativo_permitido)
    });
    const [saving, setSaving] = useState(false);

    // La colección elegida se refleja en el subtítulo aunque todavía no se haya
    // guardado: el usuario ve el cambio antes de confirmarlo.
    const nombreColeccion =
        inputs.idColeccion === "" ? "Sin colección" : colecciones.find((c) => String(c.id) === inputs.idColeccion)?.titulo;
    const actualizar = (patch: Partial<LibroFormValues>) => setInputs((current) => ({ ...current, ...patch }));

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setSaving(true);
        await onSave(
            {
                titulo: inputs.titulo,
                precio: Number(inputs.precio),
                fecha_edicion: inputs.fecha_edicion,
                alto: inputs.alto ? Number(inputs.alto) : undefined,
                ancho: inputs.ancho ? Number(inputs.ancho) : undefined,
                largo: inputs.largo ? Number(inputs.largo) : undefined,
                peso_kg: inputs.pesoKg ? Number(inputs.pesoKg) : undefined,
                stock_negativo_permitido: Number(inputs.stockNegativoPermitido || 0),
                brief: inputs.brief || undefined,
                paginas: inputs.paginas ? Number(inputs.paginas) : undefined,
                edad_min: inputs.edadMin ? Number(inputs.edadMin) : null,
                edad_max: inputs.edadMax ? Number(inputs.edadMax) : null,
                book_trailer_url: inputs.bookTrailerUrl || undefined
            },
            inputs.portadaFile,
            inputs.idColeccion ? Number(inputs.idColeccion) : null
        );
        setSaving(false);
    };

    const acciones = (
        <>
            <Button variant="secondary" type="button" onClick={onCancel}>
                Cancelar
            </Button>
            <Button type="submit" loading={saving}>
                Guardar cambios
            </Button>
        </>
    );

    return (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Card title={libro.titulo} subtitle={`ISBN ${libro.isbn} · ${nombreColeccion ?? "Sin colección"}`} actions={acciones}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: "var(--space-6)" }}>
                    <div style={{ flex: "0 1 320px" }}>
                        <PortadaLibroFields values={inputs} onChange={actualizar} />
                    </div>
                    <div style={{ flex: "1 1 420px", minWidth: 0 }}>
                        <DatosLibroFields values={inputs} onChange={actualizar} colecciones={colecciones} />
                    </div>
                </div>
            </Card>

            <Card title="Ficha del libro" subtitle="Lo que se muestra en el catálogo y en la tienda.">
                <FichaLibroFields values={inputs} onChange={actualizar} />
            </Card>

            <Card title="Medidas y envío" subtitle="Las medidas y el peso se usan para cotizar el envío.">
                <MedidasLibroFields values={inputs} onChange={actualizar} />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)", marginTop: "var(--space-5)" }}>
                    {acciones}
                </div>
            </Card>
        </form>
    );
}
