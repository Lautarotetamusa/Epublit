import React from "react";
import "../../App.css";
import { Navbar, Container } from "react-bootstrap";
import {LoginForm} from "./LoginForm";



export const Login = ({ setUser }) => {
    return (
        <div className="bdy">
            <Navbar collapseOnSelect expand="lg" bg="dark" variant="dark">
            <Container>
                <Navbar.Brand href="/">Libros Silvestres</Navbar.Brand>
            </Container>
            </Navbar>
            <div className="sign-in-box">
                <h1>Login</h1>
                <LoginForm setLoginUser={setUser}/>
            </div>
        </div>
    );
}
