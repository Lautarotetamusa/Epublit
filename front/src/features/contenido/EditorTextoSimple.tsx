import { useRef } from "react";
import { Field, IconButton, Textarea } from "../../design-system";

type EditorTextoSimpleProps = {
    label: string;
    value: string;
    onChange: (value: string) => void;
    rows?: number;
    hint?: string;
};

// Texto enriquecido "simple" de Fase 1: no hay editor WYSIWYG ni HTML libre.
// Se guarda texto con una convención mínima (negrita, cursiva, listas y
// enlaces en formato markdown) que la landing puede renderizar sin permitir
// HTML arbitrario. Los botones sólo envuelven la selección: lo que se ve en
// la previsualización es exactamente lo que se guarda.
export function EditorTextoSimple({ label, value, onChange, rows = 8, hint }: EditorTextoSimpleProps) {
    const ref = useRef<HTMLTextAreaElement>(null);

    const envolver = (antes: string, despues: string) => {
        const textarea = ref.current;
        if (!textarea) return;
        const inicio = textarea.selectionStart;
        const fin = textarea.selectionEnd;
        const seleccion = value.slice(inicio, fin) || "texto";
        const nuevo = `${value.slice(0, inicio)}${antes}${seleccion}${despues}${value.slice(fin)}`;
        onChange(nuevo);
        requestAnimationFrame(() => {
            textarea.focus();
            textarea.setSelectionRange(inicio + antes.length, inicio + antes.length + seleccion.length);
        });
    };

    const agregarLista = () => {
        const textarea = ref.current;
        if (!textarea) return;
        const inicio = textarea.selectionStart;
        const fin = textarea.selectionEnd;
        const seleccion = value.slice(inicio, fin) || "Un ítem";
        const conGuiones = seleccion
            .split("\n")
            .map((linea) => (linea.trim() === "" ? linea : `- ${linea}`))
            .join("\n");
        const nuevo = `${value.slice(0, inicio)}${conGuiones}${value.slice(fin)}`;
        onChange(nuevo);
        requestAnimationFrame(() => {
            textarea.focus();
            textarea.setSelectionRange(inicio, inicio + conGuiones.length);
        });
    };

    return (
        <Field
            label={label}
            hint={hint ?? "Acepta **negrita**, *cursiva*, listas con guiones y enlaces con [texto](/destino)."}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: "var(--space-1)" }} role="toolbar" aria-label="Formato de texto">
                <IconButton type="button" size="sm" variant="ghost" icon="bold" label="Negrita" onClick={() => envolver("**", "**")} />
                <IconButton type="button" size="sm" variant="ghost" icon="italic" label="Cursiva" onClick={() => envolver("*", "*")} />
                <IconButton type="button" size="sm" variant="ghost" icon="list" label="Lista" onClick={agregarLista} />
                <IconButton type="button" size="sm" variant="ghost" icon="link" label="Enlace" onClick={() => envolver("[", "](/destino)")} />
            </div>
            <Textarea
                ref={ref}
                rows={rows}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Escribí el texto de la página…"
            />
        </Field>
    );
}
