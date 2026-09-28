import type { TipoCliente } from "../../api/cliente";

export const TIPO_CLIENTE_LABEL: Record<string, string> = {
    inscripto: "Inscripto",
    particular: "Consumidor final",
    negro: "Mostrador"
};

export const tipoClienteBadgeTone = (tipo: TipoCliente | null): "brand" | "neutral" => (tipo === "inscripto" ? "brand" : "neutral");
