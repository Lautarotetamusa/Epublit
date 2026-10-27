import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, Button, Breadcrumb, EmptyState } from "../../design-system";
import type { Coleccion } from "../../api/coleccion";
import { useFichaLibro } from "./useFichaLibro";
import { PersonasLibroSection } from "./PersonasLibroSection";
import { StockLibroCard } from "./StockLibroCard";
import { LibroFormFields } from "./LibroFormFields";
import type { LibroFormValues } from "./LibroFormFields";
import { FullscreenSpinner } from "../../components/FullscreenSpinner";
import { useToast } from "../../notifications/ToastProvider";
import { getErrorMessage } from "../../lib/errors";

export function FichaLibroPage() {
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

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Breadcrumb items={["Libros", libro.titulo]} onNavigate={(_item, index) => index === 0 && navigate("/libros")} />
            <EdicionLibroForm
                key={libro.isbn}
                libro={libro}
                colecciones={colecciones}
                idColeccion={idColeccion}
                onSave={async (input, portadaFile, idColeccionElegida) => {
                    try {
                        await update(input, portadaFile, idColeccionElegida);
                        showToast("success", "Libro actualizado correctamente");
                    } catch (err) {
                        showToast("error", getErrorMessage(err));
                    }
                }}
            />
            <StockLibroCard libro={libro} />
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
    onSave
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
        edad_recomendada: number | null;
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
            edad_recomendada?: number;
            book_trailer_url?: string;
        },
        portadaFile: File | null,
        idColeccion: number | null
    ) => Promise<void>;
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
        edad_recomendada: libro.edad_recomendada !== null ? String(libro.edad_recomendada) : "",
        portadaUrl: libro.portada_url ?? "",
        portadaFile: null,
        bookTrailerUrl: libro.book_trailer_url ?? "",
        idColeccion: idColeccion !== null ? String(idColeccion) : "",
        stockNegativoPermitido: String(libro.stock_negativo_permitido)
    });
    const [saving, setSaving] = useState(false);

    // La colección también se muestra en el subtítulo de la ficha: así se ve
    // de un vistazo a qué colección pertenece el libro, sin bajar al campo.
    const nombreColeccion = idColeccion !== null ? colecciones.find((c) => c.id === idColeccion)?.titulo : undefined;

    const handleSubmit = async () => {
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
                edad_recomendada: inputs.edad_recomendada ? Number(inputs.edad_recomendada) : undefined,
                book_trailer_url: inputs.bookTrailerUrl || undefined
            },
            inputs.portadaFile,
            inputs.idColeccion ? Number(inputs.idColeccion) : null
        );
        setSaving(false);
    };

    return (
        <Card title={libro.titulo} subtitle={`ISBN ${libro.isbn} · ${nombreColeccion ?? "Sin colección"}`}>
            <LibroFormFields
                values={inputs}
                colecciones={colecciones}
                onChange={(patch) => setInputs((v) => ({ ...v, ...patch }))}
            />
            <Button style={{ marginTop: "var(--space-4)" }} onClick={handleSubmit} loading={saving}>
                Guardar cambios
            </Button>
        </Card>
    );
}
