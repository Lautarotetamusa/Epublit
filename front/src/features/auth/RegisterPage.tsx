import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, Field, Input, Button } from "../../design-system";
import { register } from "../../api/auth";
import { getErrorMessage } from "../../lib/errors";

export function RegisterPage() {
    const navigate = useNavigate();
    const [inputs, setInputs] = useState({ username: "", password: "", cuit: "", email: "" });
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleChange = (field: keyof typeof inputs) => (event: React.ChangeEvent<HTMLInputElement>) => {
        setInputs((values) => ({ ...values, [field]: event.target.value }));
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await register(inputs);
            navigate("/login");
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
            <Card style={{ width: 420 }} title="Creá tu cuenta">
                <form onSubmit={handleSubmit}>
                    <Field label="Usuario" required>
                        <Input value={inputs.username} onChange={handleChange("username")} autoFocus />
                    </Field>
                    <Field label="Contraseña" required style={{ marginTop: "var(--space-4)" }}>
                        <Input type="password" value={inputs.password} onChange={handleChange("password")} />
                    </Field>
                    <Field label="CUIT (sin guiones ni espacios)" required style={{ marginTop: "var(--space-4)" }}>
                        <Input value={inputs.cuit} onChange={handleChange("cuit")} />
                    </Field>
                    <Field label="Email" required error={error ?? undefined} style={{ marginTop: "var(--space-4)" }}>
                        <Input type="email" value={inputs.email} onChange={handleChange("email")} />
                    </Field>
                    <Button type="submit" fullWidth loading={loading} style={{ marginTop: "var(--space-5)" }}>
                        Crear cuenta
                    </Button>
                </form>
                <p style={{ textAlign: "center", marginTop: "var(--space-4)", fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                    ¿Ya tenés una cuenta? <Link to="/login">Ingresá</Link>
                </p>
            </Card>
        </div>
    );
}
