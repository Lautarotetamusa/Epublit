import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Card, Field, Input, Button } from "../../design-system";
import { useAuth } from "../../auth/AuthContext";
import { getErrorMessage } from "../../lib/errors";

export function LoginPage() {
    const { login } = useAuth();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await login({ username, password });
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--pino-900)",
                padding: "var(--space-6)"
            }}
        >
            <Card style={{ width: 380 }} title="Iniciá sesión">
                <form onSubmit={handleSubmit}>
                    <Field label="Usuario" required>
                        <Input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
                    </Field>
                    <Field label="Contraseña" required error={error ?? undefined} style={{ marginTop: "var(--space-4)" }}>
                        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                    </Field>
                    <Button type="submit" fullWidth loading={loading} style={{ marginTop: "var(--space-5)" }}>
                        Ingresar
                    </Button>
                </form>
                <p style={{ textAlign: "center", marginTop: "var(--space-4)", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                    ¿No tenés una cuenta? <Link to="/register">Registrate</Link>
                </p>
            </Card>
        </div>
    );
}
