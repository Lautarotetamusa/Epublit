import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Avatar, Icon, IconButton } from "../design-system";
import { useAuth } from "../auth/AuthContext";
import { useMediaQuery } from "../lib/useMediaQuery";

const LOGO = new URL("../design-system/assets/logo-epublit-lockup-light.png", import.meta.url).href;
const BREAKPOINT_COMPACTO = "(max-width: 780px)";

// Área separada del panel editorial: una sola franja oscura con la marca, la
// sección y la cuenta que opera. No hay barra lateral de Catálogo/Depósito/
// Comercial porque acá no se gestiona una editorial, se mira la campaña.
export function AdminLayout() {
    const { user, logout } = useAuth();
    const navegar = useNavigate();
    const compacto = useMediaQuery(BREAKPOINT_COMPACTO);
    const [navHover, setNavHover] = useState(false);
    const [salidaHover, setSalidaHover] = useState(false);

    function cerrarSesion() {
        logout();
        navegar("/");
    }

    return (
        <div style={{ minHeight: "100vh", background: "var(--surface-page)" }}>
            <header
                style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 40,
                    height: "var(--height-topbar)",
                    background: "var(--pino-900)",
                    borderBottom: "1px solid rgba(255,255,255,.08)",
                    color: "var(--papel-100)"
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: compacto ? "var(--space-2)" : "var(--space-4)",
                        width: "100%",
                        maxWidth: 1360,
                        height: "100%",
                        margin: "0 auto",
                        padding: compacto ? "0 var(--space-4)" : "0 var(--gutter-page)"
                    }}
                >
                    <img
                        src={LOGO}
                        alt="Epublit"
                        style={{ height: 22, width: "auto", display: "block", flex: "0 0 auto" }}
                    />

                    {compacto ? null : (
                        <>
                            <span
                                aria-hidden="true"
                                style={{ width: 1, height: 24, background: "rgba(255,255,255,.16)" }}
                            />
                            <span
                                style={{
                                    fontSize: "var(--text-2xs)",
                                    fontWeight: "var(--weight-semibold)",
                                    letterSpacing: "var(--tracking-caps)",
                                    textTransform: "uppercase",
                                    color: "rgba(255,255,255,.55)",
                                    whiteSpace: "nowrap"
                                }}
                            >
                                Administración
                            </span>
                        </>
                    )}

                    <nav
                        aria-label="Navegación de administración"
                        style={{ display: "flex", marginLeft: compacto ? 0 : "var(--space-2)" }}
                    >
                        <button
                            type="button"
                            aria-current="page"
                            onClick={() => navegar("/admin")}
                            onMouseEnter={() => setNavHover(true)}
                            onMouseLeave={() => setNavHover(false)}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "var(--space-2)",
                                height: 32,
                                padding: "0 var(--space-3)",
                                border: `1px solid ${navHover ? "rgba(255,255,255,.20)" : "rgba(255,255,255,.10)"}`,
                                borderRadius: "var(--radius-sm)",
                                background: navHover ? "rgba(255,255,255,.16)" : "rgba(255,255,255,.10)",
                                color: "var(--papel-0)",
                                fontFamily: "var(--font-body)",
                                fontSize: "var(--text-sm)",
                                fontWeight: "var(--weight-semibold)",
                                cursor: "pointer",
                                transition: "var(--transition-control)"
                            }}
                        >
                            <Icon name="users" size={16} />
                            Usuarios
                        </button>
                    </nav>

                    <div style={{ flex: 1 }} />

                    {compacto ? null : (
                        <span
                            title={user?.username}
                            style={{
                                maxWidth: 200,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                fontSize: "var(--text-xs)",
                                color: "var(--papel-300)"
                            }}
                        >
                            {user?.username}
                        </span>
                    )}

                    <Avatar name={user?.username ?? "?"} size="sm" tone="neutral" />

                    <IconButton
                        icon="log-out"
                        label="Cerrar sesión"
                        size="sm"
                        onMouseEnter={() => setSalidaHover(true)}
                        onMouseLeave={() => setSalidaHover(false)}
                        onClick={cerrarSesion}
                        style={{
                            color: "var(--papel-100)",
                            background: salidaHover ? "rgba(255,255,255,.18)" : "rgba(255,255,255,.08)",
                            border: "1px solid rgba(255,255,255,.12)"
                        }}
                    />
                </div>
            </header>

            <main
                style={{
                    width: "100%",
                    maxWidth: 1360,
                    margin: "0 auto",
                    padding: compacto
                        ? "var(--space-4) var(--space-4) var(--space-12)"
                        : "var(--space-6) var(--gutter-page) var(--space-16)"
                }}
            >
                <Outlet />
            </main>
        </div>
    );
}
