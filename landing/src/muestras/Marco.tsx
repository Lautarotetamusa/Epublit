import type { ReactNode } from "react";

interface MarcoProps {
    ruta: string;
    rotulo: string;
    children: ReactNode;
}

// Marco de ventana mínimo: deja claro que lo que se ve es una pantalla del
// sistema y dice si es una captura real o una muestra con datos inventados.
export function Marco({ ruta, rotulo, children }: MarcoProps) {
    return (
        <figure className="l-marco">
            <div className="l-marco-barra">
                <span className="l-marco-puntos" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                </span>
                <span className="l-marco-ruta">app.epublit.com.ar/{ruta}</span>
            </div>
            <div className="l-marco-cuerpo">{children}</div>
            <figcaption className="l-marco-rotulo">{rotulo}</figcaption>
        </figure>
    );
}
