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
import { DepositosPage } from "./features/depositos/DepositosPage";
import { NuevoDepositoPage } from "./features/depositos/NuevoDepositoPage";
import { FichaDepositoPage } from "./features/depositos/FichaDepositoPage";
import { MovimientosPage } from "./features/movimientos/MovimientosPage";
import { NuevoMovimientoPage } from "./features/movimientos/NuevoMovimientoPage";
import { FichaMovimientoPage } from "./features/movimientos/FichaMovimientoPage";
import { ColeccionesPage } from "./features/colecciones/ColeccionesPage";
import { NuevaColeccionPage } from "./features/colecciones/NuevaColeccionPage";
import { FichaColeccionPage } from "./features/colecciones/FichaColeccionPage";
import { PersonasPage } from "./features/personas/PersonasPage";
import { NuevaPersonaPage } from "./features/personas/NuevaPersonaPage";
import { FichaPersonaPage } from "./features/personas/FichaPersonaPage";
import { ClientesPage } from "./features/clientes/ClientesPage";
import { NuevoClientePage } from "./features/clientes/NuevoClientePage";
import { FichaClientePage } from "./features/clientes/FichaClientePage";
import { MediosPagoPage } from "./features/mediosPago/MediosPagoPage";
import { NuevoMedioPagoPage } from "./features/mediosPago/NuevoMedioPagoPage";
import { FichaMedioPagoPage } from "./features/mediosPago/FichaMedioPagoPage";
import { RolesPage } from "./features/roles/RolesPage";
import { NuevoRolPage } from "./features/roles/NuevoRolPage";
import { FichaRolPage } from "./features/roles/FichaRolPage";
import { VentasPage } from "./features/ventas/VentasPage";
import { NuevaVentaPage } from "./features/ventas/NuevaVentaPage";
import { FichaVentaPage } from "./features/ventas/FichaVentaPage";
import { PedidosPage } from "./features/tienda/pedidos/PedidosPage";
import { FichaPedidoPage } from "./features/tienda/pedidos/FichaPedidoPage";
import { ConfiguracionTiendaPage } from "./features/tienda/configuracion/ConfiguracionTiendaPage";
import { LiquidacionesPage } from "./features/liquidaciones/LiquidacionesPage";
import { NuevaLiquidacionPage } from "./features/liquidaciones/NuevaLiquidacionPage";
import { FichaLiquidacionPage } from "./features/liquidaciones/FichaLiquidacionPage";
import { ConsignacionesPage } from "./features/consignaciones/ConsignacionesPage";
import { NuevaConsignacionPage } from "./features/consignaciones/NuevaConsignacionPage";
import { FichaConsignacionPage } from "./features/consignaciones/FichaConsignacionPage";
import { DevolucionesPage } from "./features/consignaciones/DevolucionesPage";
import { NuevaDevolucionPage } from "./features/consignaciones/NuevaDevolucionPage";
import { FichaDevolucionPage } from "./features/consignaciones/FichaDevolucionPage";
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
                <Route path="/depositos" element={<DepositosPage />} />
                <Route path="/depositos/nuevo" element={<NuevoDepositoPage />} />
                <Route path="/depositos/:id" element={<FichaDepositoPage />} />
                <Route path="/movimientos" element={<MovimientosPage />} />
                <Route path="/movimientos/nuevo" element={<NuevoMovimientoPage />} />
                <Route path="/movimientos/:id" element={<FichaMovimientoPage />} />
                <Route path="/colecciones" element={<ColeccionesPage />} />
                <Route path="/colecciones/nuevo" element={<NuevaColeccionPage />} />
                <Route path="/colecciones/:id" element={<FichaColeccionPage />} />
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
                <Route path="/medios-pago" element={<MediosPagoPage />} />
                <Route path="/medios-pago/nuevo" element={<NuevoMedioPagoPage />} />
                <Route path="/medios-pago/:id" element={<FichaMedioPagoPage />} />
                <Route path="/roles" element={<RolesPage />} />
                <Route path="/roles/nuevo" element={<NuevoRolPage />} />
                <Route path="/roles/:id" element={<FichaRolPage />} />
                <Route path="/ventas" element={<VentasPage />} />
                <Route path="/ventas/nueva" element={<NuevaVentaPage />} />
                <Route path="/ventas/:id" element={<FichaVentaPage />} />
                <Route path="/pedidos" element={<PedidosPage />} />
                <Route path="/pedidos/:codigo" element={<FichaPedidoPage />} />
                <Route path="/tienda" element={<ConfiguracionTiendaPage />} />
                <Route path="/liquidaciones" element={<LiquidacionesPage />} />
                <Route path="/liquidaciones/nueva" element={<NuevaLiquidacionPage />} />
                {/* `anticipos` es una pestaña de la sección: va antes de `:id`
                    para no matchear como una liquidación con id "anticipos". */}
                <Route path="/liquidaciones/anticipos" element={<LiquidacionesPage />} />
                <Route path="/liquidaciones/:id" element={<FichaLiquidacionPage />} />
                <Route path="/consignaciones" element={<ConsignacionesPage />} />
                <Route path="/consignaciones/nueva" element={<NuevaConsignacionPage />} />
                <Route path="/consignaciones/:id" element={<FichaConsignacionPage />} />
                <Route path="/devoluciones" element={<DevolucionesPage />} />
                <Route path="/devoluciones/nueva" element={<NuevaDevolucionPage />} />
                <Route path="/devoluciones/:id" element={<FichaDevolucionPage />} />
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
