// Descargas de archivos que llegan por la API autenticada (las etiquetas de
// envío siguen siendo PDFs). Se dispara un anchor real en vez de
// `window.open`: después de un `await` el navegador puede bloquear la ventana
// emergente y el archivo quedaría inaccesible.

function disparar(url: string, filename: string | null, abrir: boolean): void {
    const anchor = document.createElement("a");
    anchor.href = url;

    if (abrir) {
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
    } else {
        anchor.download = filename || "archivo.pdf";
    }

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
}

function conUrl(blob: Blob, accion: (url: string) => void): void {
    const url = URL.createObjectURL(blob);
    accion(url);
    // El navegador ya tomó el blob al hacer click; se libera con margen para
    // no cortar la descarga en curso.
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function descargarBlob(blob: Blob, filename: string | null): void {
    conUrl(blob, (url) => disparar(url, filename, false));
}

export function abrirBlob(blob: Blob): void {
    conUrl(blob, (url) => disparar(url, null, true));
}
