import React from "react";
import "../../App.css";
import { Navbar, Container, Alert } from "react-bootstrap";
import {LoginForm} from "./LoginForm";



export const Login = ({ setUser }) => {
    const [ErrorAlert, setErrorAlert] = React.useState({show: false, content: ""});
    return (
        <div className="bdy">
            <Navbar collapseOnSelect expand="lg" bg="dark" variant="dark">
            <Container>
                <Navbar.Brand href="/">Libros Silvestres</Navbar.Brand>
            </Container>
            </Navbar>
            <div className="sign-in-box">
                <Alert variant="danger" show={ErrorAlert.show} onClose={() => setErrorAlert({show: false, content: ""})} dismissible>
                {ErrorAlert.content}
                </Alert>
                <h1>Login</h1>
                <LoginForm setErrorAlert={setErrorAlert} setLoginUser={setUser}/>
            </div>
        </div>
    );
}
