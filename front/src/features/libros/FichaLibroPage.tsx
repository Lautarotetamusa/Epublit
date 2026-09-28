import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, Button, Breadcrumb } from "../../design-system";
import { useFichaLibro } from "./useFichaLibro";
import { PersonasLibroSection } from "./PersonasLibroSection";
import { LibroFormFields } from "./LibroFormFields";
import type { LibroFormValues } from "./LibroFormFields";
import { FullscreenSpinner } from "../../components/FullscreenSpinner";
import { useToast } from "../../notifications/ToastProvider";
import { getErrorMessage } from "../../lib/errors";

export function FichaLibroPage() {
    const { isbn = "" } = useParams();
    const { libro, personas, loading, update, agregarPersonaExistente, agregarPersonaNueva, actualizarPorcentaje, quitarPersona } =
        useFichaLibro(isbn);
    const { showToast } = useToast();
    const navigate = useNavigate();

    if (loading || !libro) return <FullscreenSpinner />;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Breadcrumb items={["Libros", libro.titulo]} onNavigate={(_item, index) => index === 0 && navigate("/libros")} />
            <EdicionLibroForm
                key={libro.isbn}
                libro={libro}
                onSave={async (input, portadaFile) => {
                    try {
                        await update(input, portadaFile);
                        showToast("success", "Libro actualizado correctamente");
                    } catch (err) {
                        showToast("error", getErrorMessage(err));
                    }
                }}
            />
            <PersonasLibroSection
                personasEnLibro={[...libro.autores, ...libro.ilustradores]}
                todasLasPersonas={personas}
                onAgregarExistente={agregarPersonaExistente}
                onAgregarNueva={agregarPersonaNueva}
                onActualizarPorcentaje={actualizarPorcentaje}
                onQuitar={quitarPersona}
            />
        </div>
    );
}

function EdicionLibroForm({
    libro,
    onSave
}: {
    libro: {
        isbn: string;
        titulo: string;
        precio: number;
        stock: number | null;
        fecha_edicion: string;
        alto: number | null;
        ancho: number | null;
        largo: number | null;
        brief: string | null;
        paginas: number | null;
        edad_recomendada: number | null;
        portada_url: string | null;
        book_trailer_url: string | null;
    };
    onSave: (
        input: {
            titulo: string;
            precio: number;
            stock: number;
            fecha_edicion: string;
            alto?: number;
            ancho?: number;
            largo?: number;
            brief?: string;
            paginas?: number;
            edad_recomendada?: number;
            book_trailer_url?: string;
        },
        portadaFile: File | null
    ) => Promise<void>;
}) {
    const [inputs, setInputs] = useState<LibroFormValues>({
        isbn: libro.isbn,
        titulo: libro.titulo,
        precio: String(libro.precio),
        stock: String(libro.stock ?? 0),
        fecha_edicion: libro.fecha_edicion.slice(0, 10),
        alto: libro.alto !== null ? String(libro.alto) : "",
        ancho: libro.ancho !== null ? String(libro.ancho) : "",
        largo: libro.largo !== null ? String(libro.largo) : "",
        brief: libro.brief ?? "",
        paginas: libro.paginas !== null ? String(libro.paginas) : "",
        edad_recomendada: libro.edad_recomendada !== null ? String(libro.edad_recomendada) : "",
        portadaUrl: libro.portada_url ?? "",
        portadaFile: null,
        bookTrailerUrl: libro.book_trailer_url ?? ""
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async () => {
        setSaving(true);
        await onSave(
            {
                titulo: inputs.titulo,
                precio: Number(inputs.precio),
                stock: Number(inputs.stock),
                fecha_edicion: inputs.fecha_edicion,
                alto: inputs.alto ? Number(inputs.alto) : undefined,
                ancho: inputs.ancho ? Number(inputs.ancho) : undefined,
                largo: inputs.largo ? Number(inputs.largo) : undefined,
                brief: inputs.brief || undefined,
                paginas: inputs.paginas ? Number(inputs.paginas) : undefined,
                edad_recomendada: inputs.edad_recomendada ? Number(inputs.edad_recomendada) : undefined,
                book_trailer_url: inputs.bookTrailerUrl || undefined
            },
            inputs.portadaFile
        );
        setSaving(false);
    };

    return (
        <Card title={libro.titulo} subtitle={`ISBN ${libro.isbn}`}>
            <LibroFormFields values={inputs} onChange={(patch) => setInputs((v) => ({ ...v, ...patch }))} />
            <Button style={{ marginTop: "var(--space-4)" }} onClick={handleSubmit} loading={saving}>
                Guardar cambios
            </Button>
        </Card>
    );
}
