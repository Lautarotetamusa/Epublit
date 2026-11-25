import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Alert, Button, Field, Input, PasswordInput } from "../../design-system";
import { useAuth } from "../../auth/AuthContext";
import { AUTH_ERROR, reenviarConfirmacion } from "../../api/auth";
import { getApiErrorDetail, getErrorMessage } from "../../lib/errors";
import { normalizeEmail } from "../../lib/validation";
import { AuthLayout } from "./AuthLayout";
import { ReenviarLink } from "./ReenviarLink";

type ErrorDeLogin = { tipo: "sin_confirmar"; email: string } | { tipo: "general"; mensaje: string };

// Credenciales públicas de la cuenta demo. Se muestran sólo en el login y se
// completan desde el botón; no se publican en la landing.
const DEMO = {
    identificador: "demo",
    password: "demo12345"
};

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
    const [searchParams] = useSearchParams();
    const demoEnUrl = searchParams.get("demo") === "1";
    const [identificador, setIdentificador] = useState(demoEnUrl ? DEMO.identificador : (precargado?.identificador ?? ""));
    const [password, setPassword] = useState(demoEnUrl ? DEMO.password : "");
    const [demoVisible, setDemoVisible] = useState(demoEnUrl);
    const [demoCompletada, setDemoCompletada] = useState(demoEnUrl);
    const [error, setError] = useState<ErrorDeLogin | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (demoCompletada) document.getElementById("login-submit")?.focus();
    }, [demoCompletada]);

    const completarDemo = () => {
        setIdentificador(DEMO.identificador);
        setPassword(DEMO.password);
        setError(null);
        setDemoVisible(true);
        setDemoCompletada(true);
    };

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
                        autoFocus={!precargado?.identificador && !demoEnUrl}
                        value={identificador}
                        onChange={(e) => {
                            setIdentificador(e.target.value);
                            setDemoCompletada(false);
                        }}
                    />
                </Field>
                <Field label="Contraseña" required>
                    <PasswordInput
                        autoComplete="current-password"
                        autoFocus={Boolean(precargado?.identificador) && !demoEnUrl}
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value);
                            setDemoCompletada(false);
                        }}
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
                <Button id="login-submit" type="submit" fullWidth size="lg" loading={loading} style={{ marginTop: "var(--space-1)" }}>
                    Ingresar
                </Button>
            </form>
            {error?.tipo === "sin_confirmar" ? <ReenviarLink email={error.email} reenviar={reenviarConfirmacion} /> : null}

            {demoVisible ? (
                <div
                    style={{
                        marginTop: "var(--space-5)",
                        paddingTop: "var(--space-5)",
                        borderTop: "1px solid var(--border-subtle)",
                        display: "grid",
                        gap: "var(--space-2)"
                    }}
                >
                    <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: "var(--weight-semibold)" }}>
                        Cuenta demo
                    </p>
                    <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--text-muted)", textWrap: "pretty" }}>
                        Recorré Epublit con datos de ejemplo.
                    </p>
                    <p
                        style={{
                            margin: 0,
                            fontSize: "var(--text-xs)",
                            color: "var(--text-body)",
                            fontFamily: "var(--font-mono)",
                            lineHeight: 1.6
                        }}
                    >
                        Usuario: {DEMO.identificador}
                        <br />
                        Contraseña: {DEMO.password}
                    </p>
                    <Button type="button" variant="secondary" fullWidth onClick={completarDemo}>
                        Completar datos de demo
                    </Button>
                    {demoCompletada ? (
                        <p
                            role="status"
                            aria-live="polite"
                            style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--text-muted)" }}
                        >
                            Datos de demo completados. Presioná Ingresar.
                        </p>
                    ) : null}
                </div>
            ) : (
                <div
                    style={{
                        marginTop: "var(--space-5)",
                        paddingTop: "var(--space-5)",
                        borderTop: "1px solid var(--border-subtle)"
                    }}
                >
                    <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                        ¿Querés conocer Epublit?{" "}
                        <button
                            type="button"
                            onClick={completarDemo}
                            style={{
                                padding: 0,
                                border: 0,
                                background: "none",
                                color: "var(--text-brand)",
                                fontFamily: "inherit",
                                fontSize: "inherit",
                                fontWeight: "var(--weight-semibold)",
                                cursor: "pointer",
                                textDecoration: "underline"
                            }}
                        >
                            Probar la cuenta demo
                        </button>
                    </p>
                </div>
            )}
        </AuthLayout>
    );
}
