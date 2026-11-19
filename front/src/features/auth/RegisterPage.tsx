import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Alert, Button, Field, Input, PasswordInput } from "../../design-system";
import { AUTH_ERROR, register } from "../../api/auth";
import type { RegisterInput } from "../../api/auth";
import { formatCuit } from "../../lib/cuit";
import { PASSWORD_MIN_LENGTH } from "../../lib/validation";
import { AuthLayout } from "./AuthLayout";
import { useRegistroForm } from "./useRegistroForm";
import type { CampoRegistro, ErrorDeServidor } from "./useRegistroForm";

// Lo que trae quien vuelve desde "¿Te equivocaste de email?": el CUIT ya
// estaba bien, no tiene por qué tipearlo de nuevo.
export type RegistroPrecargado = Partial<Pick<RegisterInput, "email" | "cuit">>;

function mensajeDeServidor(error: ErrorDeServidor, email: string): ReactNode {
    switch (error.codigo) {
        case AUTH_ERROR.emailTaken:
            return (
                <>
                    Ya hay una cuenta con este email.{" "}
                    <Link to="/login" state={{ identificador: email }}>
                        Ingresá
                    </Link>
                    .
                </>
            );
        case AUTH_ERROR.cuitTaken:
            return (
                <>
                    Ya hay una cuenta con este CUIT. <Link to="/login">Ingresá</Link> con tu email o usuario.
                </>
            );
        case AUTH_ERROR.cuitNotInPadron:
            return "Este CUIT no figura en el padrón de ARCA. Revisá que sea el de la editorial.";
        default:
            return error.mensaje;
    }
}

export function RegisterPage() {
    const navigate = useNavigate();
    const precargado = (useLocation().state ?? undefined) as RegistroPrecargado | undefined;
    const { valores, errorLocal, erroresDeServidor, errorGeneral, enviando, refs: { email: emailRef, password: passwordRef, cuit: cuitRef }, cambiar, salir, enviar } = useRegistroForm({
        valoresIniciales: precargado,
        registrar: register,
        onRegistrado: ({ email, cuit }) => navigate("/revisar-correo", { state: { email, cuit } })
    });

    const errorDe = (campo: CampoRegistro): ReactNode => {
        const deServidor = erroresDeServidor[campo];
        return deServidor ? mensajeDeServidor(deServidor, valores.email) : errorLocal(campo);
    };

    return (
        <AuthLayout
            titulo="Creá tu cuenta"
            pie={
                <span>
                    ¿Ya tenés una cuenta? <Link to="/login">Ingresá</Link>
                </span>
            }
        >
            <form onSubmit={enviar} noValidate style={{ display: "grid", gap: "var(--space-4)" }}>
                <Field label="Email" required hint="Te vamos a mandar un link para confirmarlo." error={errorDe("email")}>
                    <Input
                        ref={emailRef}
                        type="email"
                        autoComplete="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder="nombre@editorial.com.ar"
                        autoFocus
                        invalid={Boolean(errorDe("email"))}
                        value={valores.email}
                        onChange={(e) => cambiar("email", e.target.value)}
                        onBlur={() => salir("email")}
                    />
                </Field>
                <Field label="Contraseña" required hint={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres.`} error={errorDe("password")}>
                    <PasswordInput
                        ref={passwordRef}
                        autoComplete="new-password"
                        invalid={Boolean(errorDe("password"))}
                        value={valores.password}
                        onChange={(e) => cambiar("password", e.target.value)}
                        onBlur={() => salir("password")}
                    />
                </Field>
                <Field
                    label="CUIT de la editorial"
                    required
                    hint="Con el CUIT traemos la razón social y los datos fiscales del padrón de ARCA."
                    error={errorDe("cuit")}
                >
                    <Input
                        ref={cuitRef}
                        mono
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="20-12345678-9"
                        invalid={Boolean(errorDe("cuit"))}
                        value={formatCuit(valores.cuit)}
                        onChange={(e) => cambiar("cuit", e.target.value)}
                        onBlur={() => salir("cuit")}
                    />
                </Field>
                {errorGeneral ? (
                    <Alert tone="error" role="alert">
                        {errorGeneral}
                    </Alert>
                ) : null}
                <Button type="submit" fullWidth size="lg" loading={enviando} style={{ marginTop: "var(--space-1)" }}>
                    Crear cuenta
                </Button>
            </form>
        </AuthLayout>
    );
}
