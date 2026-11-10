import { useState } from "react";
import { Button, Field, IconButton, Input, MediaUpload, SegmentedControl, Textarea } from "../../design-system";
import { useMediaQuery } from "../../lib/useMediaQuery";
import { useToast } from "../../notifications/ToastProvider";
import { CamposImagen } from "./CamposImagen";
import { EditorTextoSimple } from "./EditorTextoSimple";
import { imagenDesdeArchivo, imagenVacia, nuevoId } from "./tipos";
import type { Bloque, ImagenContenido } from "./tipos";
import { useSubidaImagen } from "./useSubidaImagen";

type BloqueCamposProps = {
    bloque: Bloque;
    onChange: (patch: Partial<Bloque>) => void;
};

const MAX_SIZE_MB = 8;

export function BloqueCampos({ bloque, onChange }: BloqueCamposProps) {
    switch (bloque.tipo) {
        case "hero":
            return <CamposHero bloque={bloque} onChange={onChange} />;
        case "texto":
            return <CamposTexto bloque={bloque} onChange={onChange} />;
        case "imagen-texto":
            return <CamposImagenTexto bloque={bloque} onChange={onChange} />;
        case "galeria":
            return <CamposGaleria bloque={bloque} onChange={onChange} />;
        case "cita":
            return <CamposCita bloque={bloque} onChange={onChange} />;
        case "datos":
            return <CamposDatos bloque={bloque} onChange={onChange} />;
        case "enlaces":
            return <CamposEnlaces bloque={bloque} onChange={onChange} />;
    }
}

function CamposHero({ bloque, onChange }: { bloque: Extract<Bloque, { tipo: "hero" }>; onChange: (patch: Partial<Bloque>) => void }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <Field label="Título" hint="El título grande de la apertura.">
                <Input value={bloque.titulo} onChange={(e) => onChange({ titulo: e.target.value })} placeholder="Ej.: Libros que se leen con el cuerpo" />
            </Field>
            <Field label="Bajada" hint="Una o dos líneas que acompañan al título.">
                <Textarea rows={3} value={bloque.bajada} onChange={(e) => onChange({ bajada: e.target.value })} />
            </Field>
            <CamposImagen
                imagen={bloque.imagen}
                onChange={(imagen) => onChange({ imagen })}
                uso="hero"
                label="imagen del hero"
                minWidthPx={1200}
                minHeightPx={600}
            />
        </div>
    );
}

function CamposTexto({ bloque, onChange }: { bloque: Extract<Bloque, { tipo: "texto" }>; onChange: (patch: Partial<Bloque>) => void }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <Field label="Título" hint="Opcional. Si lo dejás vacío, el bloque empieza directo con el texto.">
                <Input value={bloque.titulo} onChange={(e) => onChange({ titulo: e.target.value })} />
            </Field>
            <EditorTextoSimple
                label="Contenido"
                value={bloque.contenido}
                onChange={(contenido) => onChange({ contenido })}
                rows={8}
            />
        </div>
    );
}

function CamposImagenTexto({ bloque, onChange }: { bloque: Extract<Bloque, { tipo: "imagen-texto" }>; onChange: (patch: Partial<Bloque>) => void }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <Field label="Título" hint="Opcional.">
                <Input value={bloque.titulo} onChange={(e) => onChange({ titulo: e.target.value })} />
            </Field>
            <Field label="Texto">
                <Textarea rows={5} value={bloque.texto} onChange={(e) => onChange({ texto: e.target.value })} />
            </Field>
            <Field label="Posición de la imagen">
                <SegmentedControl
                    aria-label="Posición de la imagen"
                    style={{ maxWidth: 360 }}
                    options={[
                        { value: "izquierda", label: "Izquierda" },
                        { value: "derecha", label: "Derecha" }
                    ]}
                    value={bloque.posicion}
                    onChange={(posicion) => onChange({ posicion: posicion as "izquierda" | "derecha" })}
                />
            </Field>
            <CamposImagen
                imagen={bloque.imagen}
                onChange={(imagen) => onChange({ imagen })}
                uso="bloque"
                label="imagen del bloque"
                minWidthPx={800}
                minHeightPx={450}
            />
        </div>
    );
}

function CamposGaleria({ bloque, onChange }: { bloque: Extract<Bloque, { tipo: "galeria" }>; onChange: (patch: Partial<Bloque>) => void }) {
    // Debajo de este ancho la fila imagen + campos + acciones no entra: se
    // apila. Es el mismo criterio de layout que el resto del editor.
    const apilado = useMediaQuery("(max-width: 640px)");

    const actualizarImagen = (id: string, imagen: ImagenContenido | null) => {
        onChange({ imagenes: imagen ? bloque.imagenes.map((item) => (item.id === id ? imagen : item)) : bloque.imagenes.filter((item) => item.id !== id) });
    };

    const actualizarCampo = (id: string, patch: Partial<ImagenContenido>) => {
        onChange({ imagenes: bloque.imagenes.map((item) => (item.id === id ? { ...item, ...patch } : item)) });
    };

    const moverImagen = (indice: number, destino: number) => {
        if (destino < 0 || destino >= bloque.imagenes.length) return;
        const siguientes = [...bloque.imagenes];
        [siguientes[indice], siguientes[destino]] = [siguientes[destino], siguientes[indice]];
        onChange({ imagenes: siguientes });
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <Field label="Título" hint="Opcional.">
                <Input value={bloque.titulo} onChange={(e) => onChange({ titulo: e.target.value })} />
            </Field>
            <Field label="Columnas" hint="En pantallas chicas la galería siempre se ve en una columna.">
                <SegmentedControl
                    aria-label="Columnas de la galería"
                    style={{ maxWidth: 260 }}
                    options={[
                        { value: "2", label: "Dos" },
                        { value: "3", label: "Tres" }
                    ]}
                    value={String(bloque.columnas)}
                    onChange={(valor) => onChange({ columnas: Number(valor) as 2 | 3 })}
                />
            </Field>

            {bloque.imagenes.length === 0 ? (
                <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                    Todavía no hay imágenes. Sumá la primera y después podés ordenarlas con las flechas.
                </p>
            ) : null}

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                {bloque.imagenes.map((imagen, indice) => (
                    <ImagenGaleriaFila
                        key={imagen.id}
                        imagen={imagen}
                        indice={indice}
                        total={bloque.imagenes.length}
                        apilado={apilado}
                        onCambiar={(siguiente) => actualizarImagen(imagen.id, siguiente)}
                        onCampo={(patch) => actualizarCampo(imagen.id, patch)}
                        onMover={moverImagen}
                    />
                ))}
            </div>

            <div>
                <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    iconStart="plus"
                    disabled={bloque.imagenes.length >= 12}
                    onClick={() => onChange({ imagenes: [...bloque.imagenes, imagenVacia("img-galeria")] })}
                >
                    Agregar imagen
                </Button>
                <p style={{ margin: "var(--space-2) 0 0", fontSize: "var(--text-2xs)", color: "var(--text-muted)" }}>
                    Hasta 12 imágenes. El orden de esta lista es el orden de la grilla en la landing.
                </p>
            </div>
        </div>
    );
}

type ImagenGaleriaFilaProps = {
    imagen: ImagenContenido;
    indice: number;
    total: number;
    apilado: boolean;
    onCambiar: (imagen: ImagenContenido | null) => void;
    onCampo: (patch: Partial<ImagenContenido>) => void;
    onMover: (indice: number, destino: number) => void;
};

// Cada fila de la galería sube su propio archivo: el estado "subiendo" y el
// error son de esa colocación, no de la galería entera. Al reemplazar, el
// objectURL local se ve al instante y la fila conserva alt/epígrafe.
function ImagenGaleriaFila({ imagen, indice, total, apilado, onCambiar, onCampo, onMover }: ImagenGaleriaFilaProps) {
    const { showToast } = useToast();
    const { subiendo, subir } = useSubidaImagen();
    const [errorSubida, setErrorSubida] = useState<string | null>(null);

    const handleSelect = async (file: File) => {
        const anterior = imagen;
        const preview = imagenDesdeArchivo(file, anterior, "img-galeria");
        onCambiar(preview);
        setErrorSubida(null);

        const subida = await subir(file, "galeria");
        if (!subida) {
            onCambiar(anterior);
            setErrorSubida("No se pudo subir esta imagen. Probá de nuevo.");
            return;
        }

        onCambiar({
            ...preview,
            imagenId: subida.imagenId,
            url: subida.url,
            ancho: subida.ancho,
            alto: subida.alto,
            subiendo: false
        });
    };

    const conArchivo = imagen.imagenId !== null;

    return (
        <div
            style={{
                display: "flex",
                flexWrap: "wrap",
                flexDirection: apilado ? "column" : "row",
                alignItems: apilado ? "stretch" : "flex-start",
                gap: "var(--space-3)",
                paddingTop: indice === 0 ? 0 : "var(--space-4)",
                borderTop: indice === 0 ? "none" : "1px solid var(--border-subtle)"
            }}
        >
            <MediaUpload
                compact
                value={imagen.url || undefined}
                onSelect={handleSelect}
                onRemove={() => onCampo({ url: "", imagenId: null, subiendo: false })}
                onRejected={(mensaje) => showToast("warning", mensaje)}
                maxSizeMb={MAX_SIZE_MB}
                minWidthPx={800}
                minHeightPx={450}
                label={`imagen ${indice + 1}`}
                hint={subiendo ? "Subiendo imagen…" : "JPG, PNG o WebP."}
                invalid={Boolean(conArchivo && imagen.alt.trim() === "")}
                disabled={subiendo}
            />
            <div style={{ flex: "1 1 220px", minWidth: 0, display: "grid", gap: "var(--space-2)" }}>
                <Field
                    label="Texto alternativo"
                    required
                    error={conArchivo && imagen.alt.trim() === "" ? "Falta el texto alternativo." : undefined}
                >
                    <Input
                        value={imagen.alt}
                        invalid={Boolean(conArchivo && imagen.alt.trim() === "")}
                        onChange={(e) => onCampo({ alt: e.target.value })}
                        placeholder="Qué se ve en la imagen"
                    />
                </Field>
                <Field label="Epígrafe" hint="Opcional.">
                    <Input value={imagen.epigrafe} onChange={(e) => onCampo({ epigrafe: e.target.value })} />
                </Field>
            </div>
            <div style={{ display: "flex", flexDirection: apilado ? "row" : "column", justifyContent: apilado ? "flex-end" : undefined, gap: 1, flex: "0 0 auto" }}>
                <IconButton
                    type="button"
                    size="sm"
                    variant="ghost"
                    icon="arrow-up"
                    label={`Subir imagen ${indice + 1}`}
                    disabled={indice === 0}
                    onClick={() => onMover(indice, indice - 1)}
                />
                <IconButton
                    type="button"
                    size="sm"
                    variant="ghost"
                    icon="arrow-down"
                    label={`Bajar imagen ${indice + 1}`}
                    disabled={indice === total - 1}
                    onClick={() => onMover(indice, indice + 1)}
                />
                <IconButton
                    type="button"
                    size="sm"
                    variant="ghost"
                    icon="trash-2"
                    label={`Quitar imagen ${indice + 1} de la galería`}
                    onClick={() => onCambiar(null)}
                />
            </div>
            {errorSubida ? (
                <p style={{ margin: 0, flexBasis: "100%", fontSize: "var(--text-xs)", color: "var(--text-error)" }}>
                    {errorSubida}
                </p>
            ) : null}
        </div>
    );
}

function CamposCita({ bloque, onChange }: { bloque: Extract<Bloque, { tipo: "cita" }>; onChange: (patch: Partial<Bloque>) => void }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <Field label="Cita" hint="La frase que se destaca, sin comillas: el diseño las agrega.">
                <Textarea rows={3} value={bloque.texto} onChange={(e) => onChange({ texto: e.target.value })} />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--space-3)" }}>
                <Field label="Autor/a">
                    <Input value={bloque.autor} onChange={(e) => onChange({ autor: e.target.value })} />
                </Field>
                <Field label="Fuente o rol" hint="Ej.: Directora editorial.">
                    <Input value={bloque.fuente} onChange={(e) => onChange({ fuente: e.target.value })} />
                </Field>
            </div>
        </div>
    );
}

function CamposDatos({ bloque, onChange }: { bloque: Extract<Bloque, { tipo: "datos" }>; onChange: (patch: Partial<Bloque>) => void }) {
    const actualizarItem = (id: string, patch: { valor?: string; etiqueta?: string }) => {
        onChange({ items: bloque.items.map((item) => (item.id === id ? { ...item, ...patch } : item)) });
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <Field label="Título" hint="Opcional. Ej.: La editorial en números.">
                <Input value={bloque.titulo} onChange={(e) => onChange({ titulo: e.target.value })} />
            </Field>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {bloque.items.map((item, indice) => (
                    <div
                        key={item.id}
                        style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(90px, 0.7fr) minmax(180px, 2fr) auto",
                            alignItems: "end",
                            gap: "var(--space-3)"
                        }}
                    >
                        <Field label={indice === 0 ? "Valor" : undefined}>
                            <Input mono value={item.valor} onChange={(e) => actualizarItem(item.id, { valor: e.target.value })} placeholder="96" />
                        </Field>
                        <Field label={indice === 0 ? "Etiqueta" : undefined}>
                            <Input value={item.etiqueta} onChange={(e) => actualizarItem(item.id, { etiqueta: e.target.value })} placeholder="títulos en catálogo" />
                        </Field>
                        <IconButton
                            type="button"
                            size="sm"
                            variant="ghost"
                            icon="trash-2"
                            label={`Quitar dato ${indice + 1}`}
                            disabled={bloque.items.length <= 1}
                            onClick={() => onChange({ items: bloque.items.filter((dato) => dato.id !== item.id) })}
                        />
                    </div>
                ))}
            </div>

            <div>
                <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    iconStart="plus"
                    disabled={bloque.items.length >= 4}
                    onClick={() => onChange({ items: [...bloque.items, { id: nuevoId("dato"), valor: "", etiqueta: "" }] })}
                >
                    Agregar dato
                </Button>
                <p style={{ margin: "var(--space-2) 0 0", fontSize: "var(--text-2xs)", color: "var(--text-muted)" }}>
                    Entre dos y cuatro datos se leen mejor en la landing.
                </p>
            </div>
        </div>
    );
}

function CamposEnlaces({ bloque, onChange }: { bloque: Extract<Bloque, { tipo: "enlaces" }>; onChange: (patch: Partial<Bloque>) => void }) {
    const actualizarItem = (id: string, patch: { etiqueta?: string; href?: string; descripcion?: string }) => {
        onChange({ items: bloque.items.map((item) => (item.id === id ? { ...item, ...patch } : item)) });
    };

    const hrefValido = (href: string) => href.trim() === "" || /^(https?:\/\/|\/)/.test(href.trim());

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <Field label="Título" hint="Opcional. Ej.: Para seguir leyendo.">
                <Input value={bloque.titulo} onChange={(e) => onChange({ titulo: e.target.value })} />
            </Field>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                {bloque.items.map((item, indice) => (
                    <div
                        key={item.id}
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "var(--space-3)",
                            paddingTop: indice === 0 ? 0 : "var(--space-4)",
                            borderTop: indice === 0 ? "none" : "1px solid var(--border-subtle)"
                        }}
                    >
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr)) auto", gap: "var(--space-3)", alignItems: "end" }}>
                            <Field label="Nombre del enlace">
                                <Input value={item.etiqueta} onChange={(e) => actualizarItem(item.id, { etiqueta: e.target.value })} placeholder="Nuestro catálogo" />
                            </Field>
                            <Field
                                label="Destino"
                                hint="Ruta interna (/catalogo) o URL completa (https://…)."
                                error={!hrefValido(item.href) ? "Empezá con / o https://." : undefined}
                            >
                                <Input
                                    mono
                                    value={item.href}
                                    invalid={!hrefValido(item.href)}
                                    onChange={(e) => actualizarItem(item.id, { href: e.target.value })}
                                    placeholder="/catalogo"
                                />
                            </Field>
                            <IconButton
                                type="button"
                                size="sm"
                                variant="ghost"
                                icon="trash-2"
                                label={`Quitar enlace ${indice + 1}`}
                                disabled={bloque.items.length <= 1}
                                onClick={() => onChange({ items: bloque.items.filter((enlace) => enlace.id !== item.id) })}
                            />
                        </div>
                        <Field label="Descripción" hint="Opcional: una línea de contexto.">
                            <Input value={item.descripcion} onChange={(e) => actualizarItem(item.id, { descripcion: e.target.value })} />
                        </Field>
                    </div>
                ))}
            </div>

            <Button
                type="button"
                size="sm"
                variant="secondary"
                iconStart="plus"
                onClick={() => onChange({ items: [...bloque.items, { id: nuevoId("enlace"), etiqueta: "", href: "", descripcion: "" }] })}
            >
                Agregar enlace
            </Button>
        </div>
    );
}
