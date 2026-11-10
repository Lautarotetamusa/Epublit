import { Icon } from "../../design-system";
import type { ImagenContenido } from "./tipos";

type VistaImagenProps = {
    imagen: ImagenContenido;
    movil?: boolean;
    relacion?: string;
    sinEpigrafe?: boolean;
};

// Imagen de contenido dentro de la previsualización. Si la imagen todavía no
// tiene archivo, el marcador es neutro y explícito ("Sin imagen"): nunca se
// inventa fotografía para tapar un contenido que la editorial no cargó.
export function VistaImagen({ imagen, movil = false, relacion = "16 / 9", sinEpigrafe = false }: VistaImagenProps) {
    return (
        <figure style={{ margin: 0, minWidth: 0 }}>
            {imagen.url ? (
                <img
                    src={imagen.url}
                    alt={imagen.alt}
                    style={{
                        display: "block",
                        width: "100%",
                        aspectRatio: relacion,
                        objectFit: "cover",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border-subtle)",
                        background: "var(--papel-100)"
                    }}
                />
            ) : (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "var(--space-2)",
                        width: "100%",
                        aspectRatio: relacion,
                        borderRadius: "var(--radius-sm)",
                        border: "1px dashed var(--border-strong)",
                        background: "var(--papel-100)",
                        color: "var(--text-muted)"
                    }}
                >
                    <Icon name="image" size={movil ? 20 : 24} />
                    <span style={{ fontSize: "var(--text-2xs)", letterSpacing: "var(--tracking-caps)", textTransform: "uppercase" }}>
                        Sin imagen
                    </span>
                </div>
            )}
            {!sinEpigrafe && imagen.epigrafe.trim() !== "" ? (
                <figcaption style={{ marginTop: "var(--space-2)", fontSize: "var(--text-2xs)", color: "var(--text-muted)", lineHeight: "var(--leading-normal)" }}>
                    {imagen.epigrafe}
                </figcaption>
            ) : null}
        </figure>
    );
}
