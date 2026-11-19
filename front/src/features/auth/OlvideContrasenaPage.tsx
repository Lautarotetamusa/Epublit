import { Link, useLocation } from "react-router-dom";
import { Alert, Button, Field, Input } from "../../design-system";
import { pedirRestablecimiento } from "../../api/auth";
import { AuthLayout } from "./AuthLayout";
import { ReenviarLink } from "./ReenviarLink";
import { useOlvideContrasena } from "./useOlvideContrasena";

const textoSecundario = { margin: 0, fontSize: "var(--text-sm)", color: "var(--text-muted)", textWrap: "pretty" } as const;

// Nunca confirma si el email tiene cuenta: decirlo dejaría averiguar qué
// editoriales usan Epublit probando direcciones.
const textoReenviado = (email: string) => `Listo. Si hay una cuenta con ${email}, te llega otro link en un par de minutos.`;

export function OlvideContrasenaPage() {
    const precargado = useLocation().state as { email?: string } | null;
    const { email, setEmail, errorEmail, salir, enviar, enviando, errorGeneral, enviadoA, probarOtroEmail, emailRef } = useOlvideContrasena({
        emailInicial: precargado?.email ?? "",
        pedir: pedirRestablecimiento
    });

    const pie = (
        <span>
            ¿Te acordaste? <Link to="/login">Ingresá</Link>
        </span>
    );

    if (enviadoA) {
        return (
            <AuthLayout
                titulo="Revisá tu correo"
                icono={{ nombre: "mail", tono: "neutro" }}
                bajada={
                    <>
                        Si hay una cuenta con <strong style={{ color: "var(--text-body)", overflowWrap: "anywhere" }}>{enviadoA}</strong>, te
                        mandamos un link para elegir una contraseña nueva.
                    </>
                }
                pie={pie}
            >
                <p style={textoSecundario}>El link vence en 1 hora. Si no lo ves en unos minutos, buscá en spam o en promociones.</p>
                <ReenviarLink email={enviadoA} reenviar={pedirRestablecimiento} recienEnviado textoEnviado={textoReenviado} />
                <Button type="button" variant="ghost" size="sm" onClick={probarOtroEmail} style={{ justifySelf: "center" }}>
                    Probar con otro email
                </Button>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout
            titulo="Recuperá tu contraseña"
            bajada="Escribí el email de tu cuenta y te mandamos un link para elegir una contraseña nueva."
            pie={pie}
        >
            <form onSubmit={enviar} noValidate style={{ display: "grid", gap: "var(--space-4)" }}>
                <Field label="Email" required error={errorEmail}>
                    <Input
                        ref={emailRef}
                        type="email"
                        autoComplete="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder="nombre@editorial.com.ar"
                        autoFocus
                        invalid={Boolean(errorEmail)}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onBlur={salir}
                    />
                </Field>
                {errorGeneral ? (
                    <Alert tone="error" role="alert">
                        {errorGeneral}
                    </Alert>
                ) : null}
                <Button type="submit" fullWidth size="lg" loading={enviando} style={{ marginTop: "var(--space-1)" }}>
                    Mandarme el link
                </Button>
            </form>
        </AuthLayout>
    );
}
