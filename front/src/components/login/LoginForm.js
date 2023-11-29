import React from "react";
import {Button, Form} from 'react-bootstrap';
import { PostLogin } from "../ApiHandler";
import Swal from 'sweetalert2';

export const LoginForm = ({setLoginUser }) => {

    const [user, setUser] = React.useState({
        username: "",
        password: "",
    });

    const handleSubmit = async (event) => {
        event.preventDefault();
        const response = await PostLogin(user);
        if(response.success){            
            localStorage.setItem('loggedUser', JSON.stringify({username: user.username, token: response.token}));
            setLoginUser({username: user.username, token: response.token});
        }else{
            Swal.fire({
              title: "Error",
              text: response.error,
              icon: "error"
            });
        }
            
    };
    const handleChange = (event) => {
        setUser({
            ...user,
            [event.target.name]: event.target.value,
        });
    };

    return(
    <Form onSubmit={handleSubmit}>

      <Form.Group className="mb-3">
        <Form.Label>Usuario</Form.Label>
        <Form.Control type="text" name="username" placeholder="Usuario" onChange={handleChange}/>
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>Contraseña</Form.Label>
        <Form.Control type="password" name="password" placeholder="Constraseña" onChange={handleChange}/>
      </Form.Group>
      
      <Button variant="outline-light" type="submit">
        Enviar
      </Button>
    </Form>

    );
}