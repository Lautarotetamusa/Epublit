import { Alert, Button, Icon } from "../../design-system";
import { AuthLayout } from "./AuthLayout";
import { useEntrarConToken } from "./useEntrarConToken";

// Estados que comparten todas las páginas a las que se llega desde un link
// del mail (confirmar email, restablecer contraseña).

export function LinkConsultando({ titulo }: { titulo: string }) {
    return (
        <AuthLayout titulo={titulo}>
            <p
                role="status"
                style={{ margin: 0, display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}
            >
                <Icon name="loader-circle" size={16} color="var(--pino-600)" style={{ animation: "epublit-spin 900ms linear infinite" }} />
                Un momento, estamos revisando el link.
            </p>
        </AuthLayout>
    );
}

export function LinkConError({ titulo, mensaje }: { titulo: string; mensaje: string }) {
    return (
        <AuthLayout titulo={titulo} icono={{ nombre: "circle-alert", tono: "error" }} bajada={mensaje}>
            <Button fullWidth size="lg" variant="secondary" onClick={() => window.location.reload()}>
                Probar de nuevo
            </Button>
        </AuthLayout>
    );
}

export function EntrarConSesion({ token }: { token: string }) {
    const { entrar, entrando, error } = useEntrarConToken(token);

    return (
        <>
            {error ? (
                <Alert tone="error" role="alert">
                    {error}
                </Alert>
            ) : null}
            <Button fullWidth size="lg" iconEnd="arrow-right" loading={entrando} onClick={entrar}>
                Entrar a Epublit
            </Button>
        </>
    );
}
