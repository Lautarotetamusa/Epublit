import { Link, Navigate, useLocation } from "react-router-dom";
import { reenviarConfirmacion } from "../../api/auth";
import { AuthLayout } from "./AuthLayout";
import { ReenviarLink } from "./ReenviarLink";
import type { RegistroPrecargado } from "./RegisterPage";

export function RevisarCorreoPage() {
    const registro = (useLocation().state ?? undefined) as RegistroPrecargado | undefined;

    // Sin el email no hay a quién reenviarle nada: se llega acá sólo desde el
    // registro (el estado de la navegación sobrevive a recargar la página).
    if (!registro?.email) return <Navigate to="/register" replace />;

    return (
        <AuthLayout
            titulo="Revisá tu correo"
            icono={{ nombre: "mail", tono: "neutro" }}
            bajada={
                <>
                    Te mandamos un link a <strong style={{ color: "var(--text-body)", overflowWrap: "anywhere" }}>{registro.email}</strong> para
                    confirmar la cuenta. Hasta que lo abras no vas a poder ingresar.
                </>
            }
            pie={
                <span>
                    ¿Ya lo confirmaste? <Link to="/login" state={{ identificador: registro.email }}>Ingresá</Link>
                </span>
            }
        >
            <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-muted)", textWrap: "pretty" }}>
                El link vence en 24 horas: si no confirmás el email en ese plazo, borramos la cuenta y vas a tener que registrarte de nuevo. Si no lo ves en unos minutos, buscá en spam o en promociones.
            </p>
            <ReenviarLink email={registro.email} reenviar={reenviarConfirmacion} recienEnviado />
            <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-muted)", textAlign: "center" }}>
                ¿Te equivocaste de email?{" "}
                <Link to="/register" state={{ email: registro.email, cuit: registro.cuit }}>
                    Corregilo
                </Link>
            </p>
        </AuthLayout>
    );
}
