import { useRef, useState } from "react";
import type { FormEvent } from "react";
import type { RegisterInput } from "../../api/auth";
import { getCuitError, normalizeCuit } from "../../lib/cuit";
import { getApiErrorDetail, getErrorMessage } from "../../lib/errors";
import { getEmailError, getPasswordError, normalizeEmail } from "../../lib/validation";

export type CampoRegistro = keyof RegisterInput;

export type ErrorDeServidor = { codigo: string; mensaje: string };

const CAMPOS: CampoRegistro[] = ["email", "password", "cuit"];

const VALIDADORES: Record<CampoRegistro, (valor: string) => string | null> = {
    email: getEmailError,
    password: getPasswordError,
    cuit: getCuitError
};

function esCampoRegistro(campo: string): campo is CampoRegistro {
    return (CAMPOS as string[]).includes(campo);
}

type Opciones = {
    valoresIniciales?: Partial<RegisterInput>;
    registrar: (input: RegisterInput) => Promise<unknown>;
    onRegistrado: (input: RegisterInput) => void;
};

export function useRegistroForm({ valoresIniciales, registrar, onRegistrado }: Opciones) {
    const [valores, setValores] = useState<RegisterInput>({
        email: valoresIniciales?.email ?? "",
        password: "",
        cuit: normalizeCuit(valoresIniciales?.cuit ?? "")
    });
    const [tocados, setTocados] = useState<Record<CampoRegistro, boolean>>({
        email: false,
        password: false,
        cuit: Boolean(valoresIniciales?.cuit)
    });
    const [erroresDeServidor, setErroresDeServidor] = useState<Partial<Record<CampoRegistro, ErrorDeServidor>>>({});
    const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
    const [enviando, setEnviando] = useState(false);
    const refs = {
        email: useRef<HTMLInputElement>(null),
        password: useRef<HTMLInputElement>(null),
        cuit: useRef<HTMLInputElement>(null)
    };

    // El CUIT completo se valida apenas llega al dígito 11: es el momento en
    // que quien lo tipea espera saber si está bien, sin tener que salir del campo.
    const debeMostrarError = (campo: CampoRegistro) => tocados[campo] || (campo === "cuit" && valores.cuit.length === 11);

    const errorLocal = (campo: CampoRegistro) => (debeMostrarError(campo) ? VALIDADORES[campo](valores[campo]) : null);

    const cambiar = (campo: CampoRegistro, valor: string) => {
        setValores((actuales) => ({ ...actuales, [campo]: campo === "cuit" ? normalizeCuit(valor) : valor }));
        setErroresDeServidor(({ [campo]: _descartado, ...resto }) => resto);
    };

    const salir = (campo: CampoRegistro) => {
        setTocados((actuales) => ({ ...actuales, [campo]: true }));
        if (campo === "email") setValores((actuales) => ({ ...actuales, email: normalizeEmail(actuales.email) }));
    };

    const aplicarErrorDeApi = (err: unknown) => {
        const detalle = getApiErrorDetail(err);
        if (!detalle?.field || !esCampoRegistro(detalle.field)) {
            setErrorGeneral(getErrorMessage(err));
            return;
        }
        setErroresDeServidor({ [detalle.field]: { codigo: detalle.code, mensaje: detalle.message } });
        refs[detalle.field].current?.focus();
    };

    const enviar = async (event: FormEvent) => {
        event.preventDefault();
        const input = { ...valores, email: normalizeEmail(valores.email) };
        setValores(input);
        setTocados({ email: true, password: true, cuit: true });
        setErrorGeneral(null);
        setErroresDeServidor({});

        const primeroInvalido = CAMPOS.find((campo) => VALIDADORES[campo](input[campo]) !== null);
        if (primeroInvalido) {
            refs[primeroInvalido].current?.focus();
            return;
        }

        setEnviando(true);
        try {
            await registrar(input);
            onRegistrado(input);
        } catch (err) {
            aplicarErrorDeApi(err);
        } finally {
            setEnviando(false);
        }
    };

    return { valores, errorLocal, erroresDeServidor, errorGeneral, enviando, refs, cambiar, salir, enviar };
}
