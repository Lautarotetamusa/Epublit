import React from "react";
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import NavDropdown from 'react-bootstrap/NavDropdown';

export const NavBar = () => {
    return (
        <Navbar collapseOnSelect expand="lg" bg="dark" variant="dark">
          <Container>
            <Navbar.Brand href="/">Libros Silvestres</Navbar.Brand>
            <Navbar.Toggle aria-controls="responsive-navbar-nav" />
            <Navbar.Collapse id="responsive-navbar-nav">
              <Nav className="me-auto">
                <NavDropdown title="Libros" id="collasible-nav-dropdown">
                  <NavDropdown.Item href="nuevo-libro">Nuevo Libro</NavDropdown.Item>
                  <NavDropdown.Item href="lista-libros">Lista de Libros</NavDropdown.Item>
                </NavDropdown>
                <NavDropdown title="Ventas" id="collasible-nav-dropdown">
                  <NavDropdown.Item href="ventas">Ventas</NavDropdown.Item>
                  <NavDropdown.Item href="clientes">Clientes</NavDropdown.Item>
                </NavDropdown>
                <Nav.Link href="autores">Autores</Nav.Link>
                <Nav.Link href="ilustradores">Ilustradores</Nav.Link>
                <Nav.Link href="consignaciones">Consignaciones</Nav.Link>
              </Nav>
            </Navbar.Collapse>
          </Container>
        </Navbar>
      );
    }
