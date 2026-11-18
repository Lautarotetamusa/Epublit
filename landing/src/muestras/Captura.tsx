import { Marco } from "./Marco";

export interface CapturaProps {
    archivo: string;
    ruta: string;
    alt: string;
    ancho: number;
    alto: number;
    prioritaria?: boolean;
}

export function Captura({ archivo, ruta, alt, ancho, alto, prioritaria }: CapturaProps) {
    return (
        <Marco ruta={ruta} rotulo="Captura del sistema">
            <img
                className="l-captura"
                src={`/capturas/${archivo}`}
                alt={alt}
                width={ancho}
                height={alto}
                loading={prioritaria ? "eager" : "lazy"}
                decoding="async"
                fetchPriority={prioritaria ? "high" : "auto"}
            />
        </Marco>
    );
}
