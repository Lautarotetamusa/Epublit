import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { Alert, Button, Field, Input, PasswordInput } from "../../design-system";
import { useAuth } from "../../auth/AuthContext";
import { AUTH_ERROR, reenviarConfirmacion } from "../../api/auth";
import { getApiErrorDetail, getErrorMessage } from "../../lib/errors";
import { normalizeEmail } from "../../lib/validation";
import { AuthLayout } from "./AuthLayout";
import { ReenviarLink } from "./ReenviarLink";

type ErrorDeLogin = { tipo: "sin_confirmar"; email: string } | { tipo: "general"; mensaje: string };

// Los nombres de usuario de las cuentas anteriores se respetan tal cual se
// crearon; sólo un email se normaliza.
function normalizarIdentificador(valor: string): string {
    return valor.includes("@") ? normalizeEmail(valor) : valor;
}

function clasificarError(err: unknown, identificador: string): ErrorDeLogin {
    const detalle = getApiErrorDetail(err);
    if (detalle?.code === AUTH_ERROR.emailNotVerified) return { tipo: "sin_confirmar", email: detalle.email ?? identificador };
    return { tipo: "general", mensaje: getErrorMessage(err) };
}

export function LoginPage() {
    const { login } = useAuth();
    const precargado = useLocation().state as { identificador?: string } | null;
    const [identificador, setIdentificador] = useState(precargado?.identificador ?? "");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<ErrorDeLogin | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        const identificadorNormalizado = normalizarIdentificador(identificador);
        setIdentificador(identificadorNormalizado);
        setError(null);
        setLoading(true);
        try {
            await login({ identificador: identificadorNormalizado, password });
        } catch (err) {
            setError(clasificarError(err, identificadorNormalizado));
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout
            titulo="Ingresá a tu editorial"
            pie={
                <span>
                    ¿No tenés una cuenta? <Link to="/register">Registrate</Link>
                </span>
            }
        >
            <form onSubmit={handleSubmit} style={{ display: "grid", gap: "var(--space-4)" }}>
                <Field label="Email o usuario" required>
                    <Input
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        autoFocus={!precargado?.identificador}
                        value={identificador}
                        onChange={(e) => setIdentificador(e.target.value)}
                    />
                </Field>
                <Field label="Contraseña" required>
                    <PasswordInput
                        autoComplete="current-password"
                        autoFocus={Boolean(precargado?.identificador)}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </Field>
                <Link
                    to="/olvide-contrasena"
                    state={{ email: identificador.includes("@") ? normalizeEmail(identificador) : undefined }}
                    style={{ justifySelf: "end", marginTop: "calc(var(--space-2) * -1)", fontSize: "var(--text-xs)" }}
                >
                    ¿Olvidaste tu contraseña?
                </Link>
                {error?.tipo === "general" ? (
                    <Alert tone="error" role="alert">
                        {error.mensaje}
                    </Alert>
                ) : null}
                {error?.tipo === "sin_confirmar" ? (
                    <Alert tone="warning" role="alert" title="Todavía no confirmaste tu email">
                        Abrí el link que te mandamos a <strong style={{ overflowWrap: "anywhere" }}>{error.email}</strong> y después ingresá.
                    </Alert>
                ) : null}
                <Button type="submit" fullWidth size="lg" loading={loading} style={{ marginTop: "var(--space-1)" }}>
                    Ingresar
                </Button>
            </form>
            {error?.tipo === "sin_confirmar" ? <ReenviarLink email={error.email} reenviar={reenviarConfirmacion} /> : null}
        </AuthLayout>
    );
}
