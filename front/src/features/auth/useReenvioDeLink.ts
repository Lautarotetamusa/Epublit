import { useState } from "react";
import { AUTH_ERROR } from "../../api/auth";
import { getApiErrorDetail, getErrorMessage } from "../../lib/errors";
import { useCooldown } from "../../lib/useCooldown";

const ESPERA_ENTRE_REENVIOS_SEGUNDOS = 60;

type Resultado = { tono: "exito" | "error"; texto: string };

export type OpcionesReenvio = {
    email: string;
    reenviar: (email: string) => Promise<void>;
    // Recién registrado ya salió un mail: reenviar en el mismo segundo sólo
    // duplica mails en la bandeja.
    recienEnviado?: boolean;
    // El pedido de restablecer contraseña no puede confirmar que el email
    // existe: cada flujo dice con sus palabras qué pasó.
    textoEnviado?: (email: string) => string;
};

const textoEnviadoPorDefecto = (email: string) => `Te mandamos otro link a ${email}. Puede tardar un par de minutos.`;

function mensajeDeError(err: unknown): string {
    if (getApiErrorDetail(err)?.code === AUTH_ERROR.tooManyRequests) {
        return "Ya pediste varios links seguidos. Esperá unos minutos y probá de nuevo.";
    }
    return getErrorMessage(err);
}

export function useReenvioDeLink({ email, reenviar, recienEnviado = false, textoEnviado = textoEnviadoPorDefecto }: OpcionesReenvio) {
    const cooldown = useCooldown(ESPERA_ENTRE_REENVIOS_SEGUNDOS, recienEnviado);
    const [enviando, setEnviando] = useState(false);
    const [resultado, setResultado] = useState<Resultado | null>(null);

    const pedirOtroLink = async () => {
        setEnviando(true);
        setResultado(null);
        try {
            await reenviar(email);
            setResultado({ tono: "exito", texto: textoEnviado(email) });
            cooldown.iniciar();
        } catch (err) {
            setResultado({ tono: "error", texto: mensajeDeError(err) });
        } finally {
            setEnviando(false);
        }
    };

    return { pedirOtroLink, enviando, resultado, esperaRestante: cooldown.restante, enEspera: cooldown.activo };
}
