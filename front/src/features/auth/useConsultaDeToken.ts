import { useEffect, useRef, useState } from "react";
import { getErrorMessage } from "../../lib/errors";

export type EstadoDeConsulta<T> = { estado: "consultando" } | T | { estado: "error"; mensaje: string };

// Las páginas a las que se llega desde un link del mail consultan el token al
// montarse. El ref evita mandarlo dos veces (StrictMode monta los efectos dos
// veces en desarrollo): con un token de un solo uso, la segunda respuesta
// diría "ya usado" y taparía la real.
export function useConsultaDeToken<T>(token: string | null, consultar: (token: string) => Promise<T>, sinToken: T) {
    const [estado, setEstado] = useState<EstadoDeConsulta<T>>(token ? { estado: "consultando" } : sinToken);
    const tokenConsultado = useRef<string | null>(null);

    useEffect(() => {
        if (!token || tokenConsultado.current === token) return;
        tokenConsultado.current = token;
        consultar(token)
            .then(setEstado)
            .catch((err: unknown) => setEstado({ estado: "error", mensaje: getErrorMessage(err) }));
    }, [token, consultar]);

    return [estado, setEstado] as const;
}
