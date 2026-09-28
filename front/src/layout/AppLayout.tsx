import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { SidebarNav, Avatar } from "../design-system";
import { useAuth } from "../auth/AuthContext";

// Cada entry de navegación es también un segmento de ruta (ver App.tsx):
// `value` de SidebarNav = primer segmento del path.
const NAV_ITEMS = [
    { value: "", label: "Inicio", icon: "layout-dashboard" },
    { section: "Catálogo" },
    { value: "libros", label: "Libros", icon: "library" },
    { value: "personas", label: "Personas", icon: "user-round" },
    { section: "Comercial" },
    { value: "clientes", label: "Clientes", icon: "store" },
    { value: "ventas", label: "Ventas", icon: "receipt-text" },
    { value: "liquidaciones", label: "Liquidaciones", icon: "percent" },
    { value: "consignaciones", label: "Consignaciones", icon: "boxes" },
    { value: "devoluciones", label: "Devoluciones", icon: "truck" }
];

function currentSection(pathname: string): string {
    return pathname.split("/")[1] ?? "";
}

export function AppLayout() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const section = currentSection(location.pathname);

    return (
        <div style={{ display: "flex", minHeight: "100vh", background: "var(--papel-50)" }}>
            <SidebarNav
                items={NAV_ITEMS}
                value={section}
                onChange={(value) => navigate(`/${value}`)}
                footer={
                    <button
                        type="button"
                        onClick={() => navigate("/perfil")}
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
            <div style={{ flex: 1, minWidth: 0, padding: "var(--space-6)", overflowY: "auto" }}>
                <Outlet />
            </div>
        </div>
    );
}
