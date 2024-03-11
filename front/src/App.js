import { NavBar } from "./components/NavBar";
import "./App.css";
import React from "react";
import { Route, Routes } from "react-router-dom";
import { Login } from "./components/login/Login";
import { Spinner } from "react-bootstrap";
import { PersonProvider, usePerson } from "./context/PersonContext";
import { Autores } from "./components/personas/Autores";
import { Ilustradores } from "./components/personas/Ilustradores";
import { ListarLibros } from "./components/libros/ListaLibros";
import { CrearLibro } from "./components/libros/NuevoLibro";
import { ShowClientes } from "./components/clientes/Clientes";
import { ShowVentas } from "./components/ventas/Ventas";
import { ShowConsignaciones } from "./components/consignaciones/Consignaciones";

const Home = () => (
  <div className="bdy">
    <span className="title">Libros Silvestres</span>
  </div>
);

const LoggedInRender = () => (
  <div className="App">
    <NavBar />
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/lista-libros" element={<ListarLibros />} />
      <Route path="/nuevo-libro" element={<CrearLibro />} />
      <Route path="/ventas" element={<ShowVentas />} />
      <Route path="/clientes" element={<ShowClientes />} />
      <Route path="/autores" element={<Autores />} />
      <Route path="/ilustradores" element={<Ilustradores />} />
      <Route path="/consignaciones" element={<ShowConsignaciones />} />
    </Routes>
  </div>
);

function App() {
  const { user, loading } = usePerson();

  if (loading) {
    return (
      <Spinner className="loading-spinner" animation="border" role="status" />
    );
  }
  return (
    <PersonProvider>
      {user != {} ? <LoggedInRender /> : <Login />}
    </PersonProvider>
  );
}

export default App;
