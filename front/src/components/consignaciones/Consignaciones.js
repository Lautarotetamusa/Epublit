import React from "react";
import {Button, Col, Row, Form} from 'react-bootstrap';
import {PostConsignacion} from '../ApiHandler';

export const Consignaciones =({clientes,libros}) => {
    const [librosSeleccionados, setLibrosSeleccionados] = React.useState([]);
    const [inputs, setInputs] = React.useState({libro: "", cantidad: ""});
    
        const handleChange = (event) => {
            const name = event.target.name;
            const value = event.target.value;
            setInputs(values => ({...values, [name]: value}));
        }
    
    
    const handleSeleccionadoDelete = (isbn) => {
        setLibrosSeleccionados(librosSeleccionados.filter((libro) => libro.libro.isbn !== isbn));
        };
    
    const handleSeleccionadoAdd = (event) => {
        if(inputs.cantidad === "" || inputs.libro === ""){
            alert("Debe completar todos los campos");
            return;
        }else{
          event.preventDefault();
          setLibrosSeleccionados([...librosSeleccionados,{cantidad: inputs.cantidad, libro: libros.find((libro) => inputs.libro === libro.isbn)}]);
          setInputs({libro: "", cantidad: ""});
        }
        
        
        };
    
        const handleSubmit = (event) => {
            event.preventDefault();
            const listaLibros = librosSeleccionados.map((libro) => {
              return {
                isbn: parseInt(libro.libro.isbn),
                cantidad: parseInt(libro.cantidad),
              };
            });        
            const consignacion =JSON.stringify({
              cliente: parseInt(event.target.cliente.value),
              libros: listaLibros
            });
            
            PostConsignacion(consignacion);
            event.target.reset();
            setLibrosSeleccionados([]);
          }
    
    
    
      return (
        <div className='container mt-3'>
            <h2 className='mb-4'> Alta de consignaciones</h2>
        <Form onSubmit={handleSubmit}>
        <Col xs={4} className="mb-4">
          <Form.Group controlId="cliente">
            <h4>Cliente</h4>
              <Form.Select>
                {clientes.map((client) => (
                    <option key={client.id} value={client.id}>{client.nombre}</option>
                ))}
              </Form.Select>
            </Form.Group>
        </Col>
      <h4>Libros</h4>

    
          {librosSeleccionados.map((libro) => (
                <div key={libro.libro.isbn} className="mb-2">
                    <span className="align-middle">📘{libro.libro.titulo}</span>{' '}
                    <span className="align-middle">({libro.cantidad})</span>
                    <button type="button" className="btn-close align-middle" aria-label="Close" onClick={() => handleSeleccionadoDelete(libro.libro.isbn)}/>
                  </div>
                  ))}
    
        
        
        <Row className="mb-3 align-items-center">
            <Form.Group as={Col} controlId="libro">
                <Form.Select value={inputs.libro} name="libro" onChange={handleChange}>
                    <option value="">Seleccione un libro</option>
                    {libros.map((libro) => (
                        <option key={libro.isbn} value={libro.isbn}>{libro.titulo} ({libro.stock})</option>
                    ))}
                </Form.Select>
            </Form.Group>
            
            <Form.Group as={Col} controlId="cantidad">
              <Form.Control type="number" placeholder="Cantidad" name='cantidad'  value={inputs.cantidad||""} onChange={handleChange}/>
            </Form.Group>
            <Col >
            <Button variant="outline-primary" type='submit'onClick={handleSeleccionadoAdd}>
                Agregar
            </Button>
            </Col>
            
        </Row>
      
        <Button variant="primary" type="submit">
            Enviar
        </Button>
        
    
    
        </Form>
        </div>
      );
    }
