import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../../design-system";
import { confirmarEmail, reenviarConfirmacion } from "../../api/auth";
import { AuthLayout } from "./AuthLayout";
import { ReenviarLink } from "./ReenviarLink";
import { EntrarConSesion, LinkConError, LinkConsultando } from "./EstadosDeLink";
import { useConsultaDeToken } from "./useConsultaDeToken";

export function VerificarEmailPage() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const [resultado] = useConsultaDeToken(params.get("token"), confirmarEmail, { estado: "invalido" } as const);
    const irAIngresar = () => navigate("/login", { replace: true });

    switch (resultado.estado) {
        case "consultando":
            return <LinkConsultando titulo="Confirmando tu email" />;

        case "confirmado":
            return (
                <AuthLayout
                    titulo="Tu email quedó confirmado"
                    icono={{ nombre: "circle-check", tono: "exito" }}
                    bajada="Ya podés usar Epublit. Te mandamos un mail de bienvenida con el pedido de certificado (CSR) para dar de alta la facturación electrónica en ARCA."
                >
                    <EntrarConSesion token={resultado.token} />
                </AuthLayout>
            );

        case "ya_confirmado":
            return (
                <AuthLayout
                    titulo="Este email ya estaba confirmado"
                    icono={{ nombre: "circle-check", tono: "exito" }}
                    bajada="No hace falta que hagas nada más: ingresá con tu email y tu contraseña."
                >
                    <Button fullWidth size="lg" onClick={irAIngresar}>
                        Ingresar
                    </Button>
                </AuthLayout>
            );

        case "registro_vencido":
            return (
                <AuthLayout
                    titulo="Tu registro venció"
                    icono={{ nombre: "clock", tono: "aviso" }}
                    bajada="Pasaron más de 24 horas sin que confirmaras el email, así que borramos la cuenta. Registrate de nuevo: podés usar el mismo email y el mismo CUIT."
                >
                    <Button fullWidth size="lg" onClick={() => navigate("/register", { replace: true })}>
                        Registrarme de nuevo
                    </Button>
                </AuthLayout>
            );

        case "vencido":
            return (
                <AuthLayout
                    titulo="El link venció"
                    icono={{ nombre: "clock", tono: "aviso" }}
                    bajada={
                        <>
                            Te mandamos un link más nuevo a{" "}
                            <strong style={{ color: "var(--text-body)", overflowWrap: "anywhere" }}>{resultado.email}</strong>: abrilo
                            desde el último mail que te llegó, o pedí otro.
                        </>
                    }
                >
                    <ReenviarLink email={resultado.email} reenviar={reenviarConfirmacion} variante="primary" />
                </AuthLayout>
            );

        case "invalido":
            return (
                <AuthLayout
                    titulo="Este link no es válido"
                    icono={{ nombre: "circle-alert", tono: "error" }}
                    bajada="Puede que se haya cortado al copiarlo. Abrilo de nuevo desde el mail, o ingresá con tu email: si la cuenta todavía no está confirmada, desde ahí podés pedir otro link."
                >
                    <Button fullWidth size="lg" variant="secondary" onClick={irAIngresar}>
                        Ir a ingresar
                    </Button>
                </AuthLayout>
            );

        case "error":
            return <LinkConError titulo="No pudimos confirmar tu email" mensaje={resultado.mensaje} />;
    }
}
