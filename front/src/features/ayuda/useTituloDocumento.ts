import { useEffect } from "react";

// Las páginas de ayuda llegan por link desde un mail: el título de la pestaña
// es lo que la persona ve si la deja abierta al lado de ARCA.
export function useTituloDocumento(titulo: string) {
    useEffect(() => {
        const anterior = document.title;
        document.title = titulo;
        return () => {
            document.title = anterior;
        };
    }, [titulo]);
}
