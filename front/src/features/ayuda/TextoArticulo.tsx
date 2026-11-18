import { Fragment } from "react";
import type { ReactNode } from "react";
import { Icon } from "../../design-system";

// Marca el texto tal cual aparece en pantalla (botones, menús, campos) para
// que quien sigue la guía con ARCA abierta al lado lo encuentre de un vistazo.
export function Etiqueta({ children }: { children: ReactNode }) {
    return <strong className="ayuda-etiqueta">{children}</strong>;
}

export function Ruta({ tramos }: { tramos: string[] }) {
    return (
        <span className="ayuda-ruta">
            {tramos.map((tramo, indice) => (
                <Fragment key={tramo}>
                    {indice > 0 ? <Icon name="chevron-right" size={14} className="ayuda-ruta__separador" /> : null}
                    <Etiqueta>{tramo}</Etiqueta>
                </Fragment>
            ))}
        </span>
    );
}

export function Archivo({ children }: { children: ReactNode }) {
    return <code className="ayuda-archivo">{children}</code>;
}

export function Nota({ children }: { children: ReactNode }) {
    return (
        <p className="ayuda-nota">
            <Icon name="info" size={16} />
            <span>{children}</span>
        </p>
    );
}
