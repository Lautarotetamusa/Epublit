import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ToastProvider } from "./notifications/ToastProvider";
import { ConfirmProvider } from "./notifications/ConfirmProvider";
import { FullscreenSpinner } from "./components/FullscreenSpinner";
import { AppLayout } from "./layout/AppLayout";
import { LoginPage } from "./features/auth/LoginPage";
import { RegisterPage } from "./features/auth/RegisterPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { CatalogoPage } from "./features/libros/CatalogoPage";
import { NuevoLibroPage } from "./features/libros/NuevoLibroPage";
import { FichaLibroPage } from "./features/libros/FichaLibroPage";
import { PersonasPage } from "./features/personas/PersonasPage";
import { NuevaPersonaPage } from "./features/personas/NuevaPersonaPage";
import { FichaPersonaPage } from "./features/personas/FichaPersonaPage";
import { ClientesPage } from "./features/clientes/ClientesPage";
import { NuevoClientePage } from "./features/clientes/NuevoClientePage";
import { FichaClientePage } from "./features/clientes/FichaClientePage";
import { VentasPage } from "./features/ventas/VentasPage";
import { NuevaVentaPage } from "./features/ventas/NuevaVentaPage";
import { FichaVentaPage } from "./features/ventas/FichaVentaPage";
import { LiquidacionesPage } from "./features/liquidaciones/LiquidacionesPage";
import { ConsignacionesPage } from "./features/consignaciones/ConsignacionesPage";
import { DevolucionesPage } from "./features/consignaciones/DevolucionesPage";
import { PerfilPage } from "./features/perfil/PerfilPage";

function RedirectToPersona() {
    const { id = "" } = useParams();
    return <Navigate to={`/personas/${id}`} replace />;
}

function AppRoutes() {
    const { user, loading } = useAuth();

    if (loading) return <FullscreenSpinner />;

    if (!user) {
        return (
            <Routes>
                <Route path="/register" element={<RegisterPage />} />
                <Route path="*" element={<LoginPage />} />
            </Routes>
        );
    }

    return (
        <Routes>
            <Route element={<AppLayout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/libros" element={<CatalogoPage />} />
                <Route path="/libros/nuevo" element={<NuevoLibroPage />} />
                <Route path="/libros/:isbn" element={<FichaLibroPage />} />
                <Route path="/personas" element={<PersonasPage />} />
                <Route path="/personas/nuevo" element={<NuevaPersonaPage />} />
                <Route path="/personas/:id" element={<FichaPersonaPage />} />
                {/* Rutas viejas (autores/ilustradores eran dos listados separados,
                    ver design.md 005-unificar-personas): quedan como redirects para
                    no romper marcadores existentes. */}
                <Route path="/autores" element={<Navigate to="/personas" replace />} />
                <Route path="/autores/nuevo" element={<Navigate to="/personas/nuevo" replace />} />
                <Route path="/autores/:id" element={<RedirectToPersona />} />
                <Route path="/ilustradores" element={<Navigate to="/personas" replace />} />
                <Route path="/ilustradores/nuevo" element={<Navigate to="/personas/nuevo" replace />} />
                <Route path="/ilustradores/:id" element={<RedirectToPersona />} />
                <Route path="/clientes" element={<ClientesPage />} />
                <Route path="/clientes/nuevo" element={<NuevoClientePage />} />
                <Route path="/clientes/:id" element={<FichaClientePage />} />
                <Route path="/ventas" element={<VentasPage />} />
                <Route path="/ventas/nueva" element={<NuevaVentaPage />} />
                <Route path="/ventas/:id" element={<FichaVentaPage />} />
                <Route path="/liquidaciones" element={<LiquidacionesPage />} />
                <Route path="/consignaciones" element={<ConsignacionesPage />} />
                <Route path="/devoluciones" element={<DevolucionesPage />} />
                <Route path="/perfil" element={<PerfilPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

function App() {
    return (
        <ToastProvider>
            <ConfirmProvider>
                <AuthProvider>
                    <BrowserRouter>
                        <AppRoutes />
                    </BrowserRouter>
                </AuthProvider>
            </ConfirmProvider>
        </ToastProvider>
    );
}

export default App;
