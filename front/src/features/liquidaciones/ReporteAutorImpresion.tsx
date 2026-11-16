import { createPortal } from "react-dom";
import type { ReporteAutor } from "./ReporteAutorDocumento";
import { ReporteAutorDocumento } from "./ReporteAutorDocumento";
import "./reporteAutor.css";

// El documento vive montado pero oculto en pantalla: al imprimir, la hoja de
// estilos de impresión esconde la app y deja sólo esto. Va en un portal al
// `body` para quedar fuera del layout y del diálogo, que se ocultan enteros.
export function ReporteAutorImpresion({ reporte }: { reporte: ReporteAutor }) {
    return createPortal(
        <div className="reporte-autor-impresion">
            <ReporteAutorDocumento reporte={reporte} />
        </div>,
        document.body
    );
}
