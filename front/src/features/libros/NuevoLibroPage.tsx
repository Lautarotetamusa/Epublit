import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Button, Breadcrumb } from "../../design-system";
import { LibroFormFields } from "./LibroFormFields";
import type { LibroFormValues } from "./LibroFormFields";
import { PersonasLibroSection } from "./PersonasLibroSection";
import { useNuevoLibro } from "./useNuevoLibro";
import { useTodasLasPersonas } from "./useTodasLasPersonas";
import { usePersonasPendientes } from "./usePersonasPendientes";
import { addLibroPersonas } from "../../api/libroPersona";
import { useToast } from "../../notifications/ToastProvider";
import { getErrorMessage } from "../../lib/errors";

export function NuevoLibroPage() {
    const { saving, create } = useNuevoLibro();
    const { personas, setPersonas } = useTodasLasPersonas();
    const { pendientes, agregarExistente, agregarNueva, actualizarPorcentaje, quitar } = usePersonasPendientes(personas, (persona) =>
        setPersonas((current) => [...current, persona])
    );
    const { showToast } = useToast();
    const navigate = useNavigate();

    const [inputs, setInputs] = useState<LibroFormValues>({
        isbn: "",
        titulo: "",
        fecha_edicion: "",
        precio: "",
        stock: "",
        alto: "",
        ancho: "",
        largo: "",
        brief: "",
        paginas: "",
        edad_recomendada: "",
        portadaUrl: "",
        portadaFile: null,
        bookTrailerUrl: ""
    });

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        try {
            const libro = await create(
                {
                    isbn: inputs.isbn,
                    titulo: inputs.titulo,
                    fecha_edicion: inputs.fecha_edicion,
                    precio: Number(inputs.precio),
                    stock: inputs.stock ? Number(inputs.stock) : undefined,
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
            if (pendientes.length > 0) {
                await addLibroPersonas(
                    libro.isbn,
                    pendientes.map((p) => ({ id_persona: p.id_persona, tipo: p.tipo, porcentaje: p.porcentaje }))
                );
            }
            showToast("success", "Libro creado correctamente");
            navigate(`/libros/${libro.isbn}`);
        } catch (err) {
            showToast("error", getErrorMessage(err));
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <Breadcrumb items={["Libros", "Nuevo libro"]} onNavigate={(_item, index) => index === 0 && navigate("/libros")} />
            <Card title="Nuevo libro">
                <form onSubmit={handleSubmit}>
                    <LibroFormFields values={inputs} onChange={(patch) => setInputs((v) => ({ ...v, ...patch }))} isbnEditable />
                    <Button type="submit" style={{ marginTop: "var(--space-4)" }} loading={saving}>
                        Guardar libro
                    </Button>
                </form>
            </Card>
            <PersonasLibroSection
                personasEnLibro={pendientes}
                todasLasPersonas={personas}
                onAgregarExistente={agregarExistente}
                onAgregarNueva={agregarNueva}
                onActualizarPorcentaje={actualizarPorcentaje}
                onQuitar={quitar}
            />
        </div>
    );
}
