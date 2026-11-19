import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Button, Field, PasswordInput } from "../../design-system";
import { consultarRestablecimiento, pedirRestablecimiento, restablecerContrasena } from "../../api/auth";
import type { CuentaRestablecimiento } from "../../api/auth";
import { PASSWORD_MIN_LENGTH } from "../../lib/validation";
import { AuthLayout } from "./AuthLayout";
import { EntrarConSesion, LinkConError, LinkConsultando } from "./EstadosDeLink";
import { ReenviarLink } from "./ReenviarLink";
import { useRestablecerContrasena } from "./useRestablecerContrasena";

const resaltado = { color: "var(--text-body)", overflowWrap: "anywhere" } as const;

// Nombrar la cuenta confirma que el link es de la editorial correcta, y en
// las cuentas viejas recuerda con qué usuario se entra.
function DescripcionCuenta({ cuenta }: { cuenta: CuentaRestablecimiento }) {
    return (
        <>
            Es para la cuenta de <strong style={resaltado}>{cuenta.nombre}</strong>
            {cuenta.usuario ? (
                <>
                    , usuario <strong style={resaltado}>{cuenta.usuario}</strong>
                </>
            ) : null}
            .
        </>
    );
}

const pedirOtroLink = (
    <Link to="/olvide-contrasena" replace>
        pedí otro link
    </Link>
);

export function RestablecerContrasenaPage() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const { estado, password, setPassword, errorPassword, salir, guardar, guardando, errorGeneral, passwordRef } = useRestablecerContrasena({
        token: params.get("token"),
        consultar: consultarRestablecimiento,
        restablecer: restablecerContrasena
    });

    switch (estado.estado) {
        case "consultando":
            return <LinkConsultando titulo="Restablecer contraseña" />;

        case "valido":
            return (
                <AuthLayout titulo="Elegí una contraseña nueva" bajada={<DescripcionCuenta cuenta={estado.cuenta} />}>
                    <form onSubmit={guardar} noValidate style={{ display: "grid", gap: "var(--space-4)" }}>
                        <Field label="Contraseña nueva" required hint={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres.`} error={errorPassword}>
                            <PasswordInput
                                ref={passwordRef}
                                autoComplete="new-password"
                                autoFocus
                                invalid={Boolean(errorPassword)}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onBlur={salir}
                            />
                        </Field>
                        {errorGeneral ? (
                            <Alert tone="error" role="alert">
                                {errorGeneral}
                            </Alert>
                        ) : null}
                        <Button type="submit" fullWidth size="lg" loading={guardando} style={{ marginTop: "var(--space-1)" }}>
                            Guardar contraseña
                        </Button>
                    </form>
                </AuthLayout>
            );

        case "restablecido":
            return (
                <AuthLayout
                    titulo="Tu contraseña quedó cambiada"
                    icono={{ nombre: "circle-check", tono: "exito" }}
                    bajada="La próxima vez que ingreses, usá la contraseña nueva."
                >
                    <EntrarConSesion token={estado.token} />
                </AuthLayout>
            );

        case "vencido":
            return (
                <AuthLayout
                    titulo="El link venció"
                    icono={{ nombre: "clock", tono: "aviso" }}
                    bajada={
                        <>
                            Los links para restablecer la contraseña duran 1 hora. Pedí uno nuevo para{" "}
                            <strong style={resaltado}>{estado.email}</strong> y abrilo desde el último mail que te llegue.
                        </>
                    }
                >
                    <ReenviarLink email={estado.email} reenviar={pedirRestablecimiento} variante="primary" />
                </AuthLayout>
            );

        case "usado":
            return (
                <AuthLayout
                    titulo="Este link ya se usó"
                    icono={{ nombre: "circle-alert", tono: "aviso" }}
                    bajada={<>Cada link sirve una sola vez. Si ya cambiaste la contraseña, ingresá con la nueva; si no, {pedirOtroLink}.</>}
                >
                    <Button fullWidth size="lg" onClick={() => navigate("/login", { replace: true })}>
                        Ingresar
                    </Button>
                </AuthLayout>
            );

        case "invalido":
            return (
                <AuthLayout
                    titulo="Este link no es válido"
                    icono={{ nombre: "circle-alert", tono: "error" }}
                    bajada="Puede que se haya cortado al copiarlo. Abrilo de nuevo desde el mail, o pedí otro."
                >
                    <Button fullWidth size="lg" variant="secondary" onClick={() => navigate("/olvide-contrasena", { replace: true })}>
                        Pedir otro link
                    </Button>
                </AuthLayout>
            );

        case "error":
            return <LinkConError titulo="No pudimos revisar el link" mensaje={estado.mensaje} />;
    }
}
