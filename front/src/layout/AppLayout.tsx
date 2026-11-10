import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { SidebarNav, Avatar, IconButton } from "../design-system";
import { useAuth } from "../auth/AuthContext";
import { useMediaQuery } from "../lib/useMediaQuery";

// Cada entry de navegación es también un segmento de ruta (ver App.tsx):
// `value` de SidebarNav = primer segmento del path.
const NAV_ITEMS = [
    { value: "", label: "Inicio", icon: "layout-dashboard" },
    { section: "Catálogo" },
    { value: "libros", label: "Libros", icon: "library" },
    { value: "colecciones", label: "Colecciones", icon: "book-open" },
    { value: "personas", label: "Personas", icon: "user-round" },
    { value: "roles", label: "Roles", icon: "tag" },
    // Depósito es su propia sección: es otro trabajo (dónde están los libros)
    // distinto del catálogo (qué libros hay).
    { section: "Depósito" },
    { value: "depositos", label: "Depósitos", icon: "building-2" },
    { value: "movimientos", label: "Movimientos", icon: "package" },
    { section: "Comercial" },
    { value: "clientes", label: "Clientes", icon: "store" },
    { value: "ventas", label: "Ventas", icon: "receipt-text" },
    { value: "medios-pago", label: "Medios de pago", icon: "banknote" },
    { value: "liquidaciones", label: "Liquidaciones", icon: "percent" },
    { value: "consignaciones", label: "Consignaciones", icon: "boxes" },
    { value: "devoluciones", label: "Devoluciones", icon: "truck" },
    // La tienda online es un canal de venta con su propio ciclo (pedido →
    // pago → aceptación → envío), distinto del mostrador de Ventas.
    { section: "Tienda online" },
    { value: "pedidos", label: "Pedidos", icon: "package" },
    { value: "tienda", label: "Configuración", icon: "settings" },
    // El contenido institucional es del sitio, no del catálogo ni del canal de
    // venta: tiene su propia sección aunque en Fase 1 viva sólo en el panel.
    { section: "Sitio web" },
    { value: "contenido", label: "Contenido", icon: "file-text" }
];

// Debajo de este ancho la barra lateral deja de tener sentido: se convierte
// en un panel que se abre desde la barra superior. El corte es de layout, no
// de contenido: a 900px ya no entran 248px de navegación y una tabla.
const BREAKPOINT_MOVIL = "(max-width: 900px)";

function currentSection(pathname: string): string {
    return pathname.split("/")[1] ?? "";
}

export function AppLayout() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const section = currentSection(location.pathname);
    const esMovil = useMediaQuery(BREAKPOINT_MOVIL);
    const [navAbierto, setNavAbierto] = useState(false);

    useEffect(() => {
        if (!navAbierto) return;
        const anterior = document.body.style.overflow;
        const cerrarConEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") setNavAbierto(false);
        };
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", cerrarConEscape);
        return () => {
            document.body.style.overflow = anterior;
            window.removeEventListener("keydown", cerrarConEscape);
        };
    }, [navAbierto]);

    const navegacion = (
        <SidebarNav
            items={NAV_ITEMS}
            value={section}
            onChange={(value) => {
                setNavAbierto(false);
                navigate(`/${value}`);
            }}
            footer={
                <button
                    type="button"
                    onClick={() => {
                        setNavAbierto(false);
                        navigate("/perfil");
                    }}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-3)",
                        width: "100%",
                        background: "none",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        color: "var(--papel-100)"
                    }}
                    aria-label="Ir a mi perfil"
                >
                    <Avatar name={user?.username ?? "?"} size="sm" />
                    <span style={{ fontSize: "var(--text-sm)" }}>{user?.username}</span>
                </button>
            }
        />
    );

    return (
        <div style={{ display: "flex", minHeight: "100vh", background: "var(--papel-50)" }}>
            {!esMovil ? navegacion : null}

            {esMovil && navAbierto ? (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Navegación"
                    onClick={() => setNavAbierto(false)}
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 60,
                        background: "rgba(12,33,32,.42)",
                        backdropFilter: "blur(2px)"
                    }}
                >
                    <div
                        onClick={(event) => event.stopPropagation()}
                        style={{
                            position: "absolute",
                            inset: "0 auto 0 0",
                            width: "var(--width-sidebar)",
                            background: "var(--papel-900)",
                            overflowY: "auto",
                            boxShadow: "var(--shadow-overlay)"
                        }}
                    >
                        {navegacion}
                        <div style={{ position: "absolute", top: 10, right: 8 }}>
                            <IconButton
                                type="button"
                                icon="x"
                                label="Cerrar navegación"
                                size="sm"
                                variant="ghost"
                                style={{ color: "var(--papel-100)", background: "transparent" }}
                                onClick={() => setNavAbierto(false)}
                            />
                        </div>
                    </div>
                </div>
            ) : null}

            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                {esMovil ? (
                    <div
                        style={{
                            position: "sticky",
                            top: 0,
                            zIndex: 30,
                            display: "flex",
                            alignItems: "center",
                            gap: "var(--space-2)",
                            height: "var(--height-topbar)",
                            padding: "0 var(--space-3)",
                            background: "var(--papel-0)",
                            borderBottom: "1px solid var(--border-subtle)"
                        }}
                    >
                        <IconButton
                            type="button"
                            icon="menu"
                            label={navAbierto ? "Cerrar navegación" : "Abrir navegación"}
                            variant="ghost"
                            onClick={() => setNavAbierto((abierto) => !abierto)}
                        />
                        <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-md)", fontWeight: "var(--weight-semibold)", letterSpacing: "var(--tracking-tight)" }}>
                            Epublit
                        </span>
                    </div>
                ) : null}

                <div style={{ flex: 1, minWidth: 0, padding: esMovil ? "var(--space-4)" : "var(--space-6)", overflowY: "auto" }}>
                    <Outlet />
                </div>
            </div>
        </div>
    );
}
