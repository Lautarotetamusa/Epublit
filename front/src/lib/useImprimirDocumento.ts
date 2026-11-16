import { useCallback, useEffect, useRef } from "react";

type UseImprimirDocumentoOptions = {
    // Clase CSS del documento: sus imágenes tienen que estar cargadas antes de
    // abrir el diálogo, o el PDF sale sin ellas.
    claseDocumento: string;
    // `?print=1` dispara el diálogo una sola vez, después de que el documento
    // y sus imágenes estén listos.
    auto?: boolean;
    listoParaImprimir?: boolean;
};

const ESPERA_MAXIMA_IMAGEN_MS = 5000;

function esperarImagen(imagen: HTMLImageElement): Promise<void> {
    if (imagen.complete) return Promise.resolve();

    return new Promise((resolve) => {
        let resuelta = false;
        const terminar = () => {
            if (resuelta) return;
            resuelta = true;
            imagen.removeEventListener("load", terminar);
            imagen.removeEventListener("error", terminar);
            window.clearTimeout(timeout);
            resolve();
        };

        const timeout = window.setTimeout(terminar, ESPERA_MAXIMA_IMAGEN_MS);
        imagen.addEventListener("load", terminar);
        imagen.addEventListener("error", terminar);
    });
}

async function esperarRecursos(claseDocumento: string): Promise<void> {
    await document.fonts.ready;

    const imagenes = Array.from(
        document.querySelectorAll<HTMLImageElement>(`.${claseDocumento} img`)
    );
    await Promise.all(imagenes.map(esperarImagen));
}

// Quita `print=1` de la URL sin navegar: si el usuario recarga, no se vuelve a
// abrir el diálogo de impresión.
function limpiarParametroPrint(): void {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("print")) return;

    url.searchParams.delete("print");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export function useImprimirDocumento({
    claseDocumento,
    auto = false,
    listoParaImprimir = true
}: UseImprimirDocumentoOptions) {
    const yaImpreso = useRef(false);

    const imprimir = useCallback(async () => {
        await esperarRecursos(claseDocumento);
        window.print();
    }, [claseDocumento]);

    useEffect(() => {
        if (!auto || !listoParaImprimir || yaImpreso.current) return;

        let cancelado = false;
        const ejecutar = async () => {
            await esperarRecursos(claseDocumento);
            if (cancelado || yaImpreso.current) return;

            yaImpreso.current = true;
            limpiarParametroPrint();
            window.print();
        };

        void ejecutar();

        return () => {
            cancelado = true;
        };
    }, [auto, listoParaImprimir, claseDocumento]);

    return { imprimir };
}
