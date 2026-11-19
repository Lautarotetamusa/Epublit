import type { ReactNode } from "react";
import { Card, Icon } from "../../design-system";
import logoEpublit from "../../design-system/assets/logo-epublit-lockup-light.png";

type Tono = "neutro" | "exito" | "aviso" | "error";

type Props = {
    titulo: string;
    bajada?: ReactNode;
    // Ícono de estado para las pantallas que informan un resultado (revisar
    // correo, link confirmado o vencido); los formularios no lo llevan.
    icono?: { nombre: string; tono: Tono };
    pie?: ReactNode;
    children?: ReactNode;
};

const COLOR_ICONO: Record<Tono, { fondo: string; trazo: string }> = {
    neutro: { fondo: "var(--pino-50)", trazo: "var(--pino-600)" },
    exito: { fondo: "var(--pino-50)", trazo: "var(--pino-600)" },
    aviso: { fondo: "var(--aviso-100)", trazo: "var(--aviso-600)" },
    error: { fondo: "var(--error-100)", trazo: "var(--error-600)" }
};

export function AuthLayout({ titulo, bajada, icono, pie, children }: Props) {
    return (
        <main
            style={{
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "var(--space-6)",
                background: "var(--pino-900)",
                padding: "var(--space-10) var(--space-4)"
            }}
        >
            <img src={logoEpublit} alt="Epublit" height={28} style={{ width: "auto" }} />
            <Card style={{ width: "100%", maxWidth: 400 }} footer={pie}>
                <div style={{ display: "grid", gap: "var(--space-5)" }}>
                    <header style={{ display: "grid", gap: "var(--space-2)" }}>
                        {icono ? (
                            <span
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: 40,
                                    height: 40,
                                    marginBottom: "var(--space-2)",
                                    borderRadius: "var(--radius-md)",
                                    background: COLOR_ICONO[icono.tono].fondo,
                                    color: COLOR_ICONO[icono.tono].trazo
                                }}
                            >
                                <Icon name={icono.nombre} size={20} />
                            </span>
                        ) : null}
                        <h1
                            style={{
                                margin: 0,
                                fontFamily: "var(--font-display)",
                                fontSize: "var(--text-xl)",
                                fontWeight: "var(--weight-semibold)",
                                letterSpacing: "var(--tracking-tight)",
                                lineHeight: 1.2,
                                textWrap: "balance"
                            }}
                        >
                            {titulo}
                        </h1>
                        {bajada ? (
                            <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-muted)", textWrap: "pretty" }}>{bajada}</p>
                        ) : null}
                    </header>
                    {children}
                </div>
            </Card>
        </main>
    );
}
