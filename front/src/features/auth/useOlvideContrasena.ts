import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { getErrorMessage } from "../../lib/errors";
import { getEmailError, normalizeEmail } from "../../lib/validation";

type Opciones = {
    emailInicial: string;
    pedir: (email: string) => Promise<void>;
};

export function useOlvideContrasena({ emailInicial, pedir }: Opciones) {
    const [email, setEmail] = useState(emailInicial);
    const [tocado, setTocado] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
    const [enviadoA, setEnviadoA] = useState<string | null>(null);
    const emailRef = useRef<HTMLInputElement>(null);

    const errorEmail = tocado ? getEmailError(email) : null;

    const salir = () => {
        setTocado(true);
        setEmail(normalizeEmail(email));
    };

    const enviar = async (event: FormEvent) => {
        event.preventDefault();
        const normalizado = normalizeEmail(email);
        setEmail(normalizado);
        setTocado(true);
        setErrorGeneral(null);
        if (getEmailError(normalizado)) {
            emailRef.current?.focus();
            return;
        }

        setEnviando(true);
        try {
            await pedir(normalizado);
            setEnviadoA(normalizado);
        } catch (err) {
            setErrorGeneral(getErrorMessage(err));
        } finally {
            setEnviando(false);
        }
    };

    const probarOtroEmail = () => {
        setEnviadoA(null);
        setTocado(false);
    };

    return { email, setEmail, errorEmail, salir, enviar, enviando, errorGeneral, enviadoA, probarOtroEmail, emailRef };
}
