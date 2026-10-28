import type { ComprobanteDTO } from "../../api/comprobantes";
import { FacturaDocumento } from "./FacturaDocumento";
import { RemitoDocumento } from "./RemitoDocumento";
import "./comprobante.css";

// `plantillaVersion` se conserva en el DTO para poder cambiar el layout en el
// futuro. Hoy sólo existe la versión 1; cualquier versión desconocida cae en
// este layout genérico en lugar de romper la vista.
export function ComprobanteDocumento({ comprobante }: { comprobante: ComprobanteDTO }) {
    if (comprobante.clase === "remito") {
        return <RemitoDocumento comprobante={comprobante} />;
    }

    return <FacturaDocumento comprobante={comprobante} />;
}
