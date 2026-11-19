import { useRef, useState } from "react";
import type { FormEvent } from "react";
import type { ConsultaRestablecimiento, Restablecimiento } from "../../api/auth";
import { getErrorMessage } from "../../lib/errors";
import { getPasswordError } from "../../lib/validation";
import { useConsultaDeToken } from "./useConsultaDeToken";

type Opciones = {
    token: string | null;
    consultar: (token: string) => Promise<ConsultaRestablecimiento>;
    restablecer: (token: string, password: string) => Promise<Restablecimiento>;
};

// El link se consulta al abrir la página (no recién al guardar) para no hacer
// escribir una contraseña nueva sobre un link que ya venció. Si vence entre
// que se abrió y se guardó, la respuesta del guardado reemplaza el estado.
export function useRestablecerContrasena({ token, consultar, restablecer }: Opciones) {
    const [estado, setEstado] = useConsultaDeToken<ConsultaRestablecimiento | Restablecimiento>(token, consultar, { estado: "invalido" });
    const [password, setPassword] = useState("");
    const [tocado, setTocado] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
    const passwordRef = useRef<HTMLInputElement>(null);

    const errorPassword = tocado ? getPasswordError(password) : null;

    const guardar = async (event: FormEvent) => {
        event.preventDefault();
        setTocado(true);
        setErrorGeneral(null);
        if (!token || getPasswordError(password)) {
            passwordRef.current?.focus();
            return;
        }

        setGuardando(true);
        try {
            setEstado(await restablecer(token, password));
        } catch (err) {
            setErrorGeneral(getErrorMessage(err));
        } finally {
            setGuardando(false);
        }
    };

    return { estado, password, setPassword, errorPassword, salir: () => setTocado(true), guardar, guardando, errorGeneral, passwordRef };
}
