import type { ReactNode } from "react";

// Render mínimo de la convención de texto de Fase 1: párrafos separados por
// línea en blanco, **negrita**, *cursiva*, listas con "- " y enlaces
// [texto](/destino). No interpreta HTML: lo que se guarda es lo que se ve.
function inline(texto: string, clave: string): ReactNode[] {
    const partes = texto.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g).filter(Boolean);
    return partes.map((parte, indice) => {
        const key = `${clave}-${indice}`;
        if (parte.startsWith("**") && parte.endsWith("**")) {
            return <strong key={key}>{parte.slice(2, -2)}</strong>;
        }
        if (parte.startsWith("*") && parte.endsWith("*")) {
            return <em key={key}>{parte.slice(1, -1)}</em>;
        }
        const enlace = parte.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (enlace) {
            return (
                <a key={key} href={enlace[2]} onClick={(event) => event.preventDefault()}>
                    {enlace[1]}
                </a>
            );
        }
        return <span key={key}>{parte}</span>;
    });
}

export function TextoRico({ texto, movil }: { texto: string; movil: boolean }) {
    const bloques = texto.split(/\n{2,}/).filter((bloque) => bloque.trim() !== "");

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-4)",
                fontSize: movil ? "var(--text-base)" : "var(--text-md)",
                lineHeight: "var(--leading-relaxed)",
                color: "var(--text-body)",
                maxWidth: "var(--width-prose)",
                textWrap: "pretty"
            }}
        >
            {bloques.map((bloque, indiceBloque) => {
                const lineas = bloque.split("\n");
                const esLista = lineas.every((linea) => linea.trim().startsWith("- "));
                if (esLista) {
                    return (
                        <ul key={indiceBloque} style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
                            {lineas.map((linea, indiceLinea) => (
                                <li key={indiceLinea}>{inline(linea.replace(/^\s*-\s+/, ""), `${indiceBloque}-${indiceLinea}`)}</li>
                            ))}
                        </ul>
                    );
                }
                return <p key={indiceBloque} style={{ margin: 0 }}>{inline(lineas.join(" "), String(indiceBloque))}</p>;
            })}
        </div>
    );
}
