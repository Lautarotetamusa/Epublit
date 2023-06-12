import DataTable from 'react-data-table-component';
import React from 'react';
import Form from 'react-bootstrap/Form';
import InputGroup from 'react-bootstrap/InputGroup';
import Button from 'react-bootstrap/Button';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import ListGroup from 'react-bootstrap/ListGroup';
import { PutLibro, GetLibro,PutPersonaLibro, DeletePersonFromBook,PostPeopleLibro,PostPeople} from '../ApiHandler';
import Modal from 'react-bootstrap/Modal';
import {ModalPersonaExistente,ModalNuevaPersona} from './NuevoLibro';





export const ListaLibros = ({libros,people,setLibros}) => {
    const [filterText, setFilterText] = React.useState('');
	const [resetPaginationToggle, setResetPaginationToggle] = React.useState(false);
    const [showModal, setModalShow] = React.useState(false);
    const [libroEdit, setLibroEdit] = React.useState({});
	
	const filteredItems = libros.filter(
		item => item.titulo && item.titulo.toLowerCase().includes(filterText.toLowerCase()),
	);
    
    

	const subHeaderComponentMemo = React.useMemo(() => {
		const handleClear = () => {
			if (filterText) {
				setResetPaginationToggle(!resetPaginationToggle);
				setFilterText('');
			}
		};

		return (
			<FilterComponent onFilter={e => setFilterText(e.target.value)} onClear={handleClear} filterText={filterText} />
		);
	}, [filterText, resetPaginationToggle]);




    const handleButtonClick = (e, isbn) => {
        e.preventDefault();
        
        setLibroEdit(libros.find(libro => libro.isbn === isbn));
        setModalShow(true);
        

    };
   

	return (
    <div className='container mt-3'>
      <ModalEditLibro show={showModal} setShow={setModalShow} libro={libroEdit} libros={libros} setLibros={setLibros}/>
      <DataTable
			title="Libros"
			columns={columns(handleButtonClick)}
			data={filteredItems}
			pagination
			paginationResetDefaultPage={resetPaginationToggle} // optionally, a hook to reset pagination to page 1
			subHeader
			subHeaderComponent={subHeaderComponentMemo}
			persistTableHead
            expandableRows
            expandableRowsComponent={(props) => ExpandedComponent({ ...props, people })}
             
			
		/>
        
    </div>
		
	);
}


const ExpandedComponent = ({ data,people }) => {
    const [loading, setLoading] = React.useState(true);
    const [libro, setLibro] = React.useState(null);
    React.useEffect(() => {
            fetchLibro();
        }, [data.isbn]);
    const fetchLibro = async () => {
        try {
            const libro = await GetLibro(data.isbn);
            setLibro(libro);
            setLoading(false);
        } catch (error) {
            console.error(error);
            setLoading(false);
        }
    }

    
    const HandleExistentePush = (person) => {

        const personPost = JSON.stringify({id:person.id,porcentaje:person.porcentaje,tipo:person.tipo});

        PostPeopleLibro({people:personPost,isbn:data.isbn});

        setLibro({...libro,ilustradores:[...libro.ilustradores,person]});
    }
    const HandleNuevoPush = async(person) => {
        
        const response = await PostPeople(person[1]);
        PostPeopleLibro({people:JSON.stringify({id:response.data.id,porcentaje:person[1].porcentaje,tipo:person[0].tipo}),isbn:data.isbn});
        person[1].id = response.data.id;
        person[1].tipo = person[0].tipo;
        setLibro({...libro,ilustradores:[...libro.ilustradores,person[1]]});
        
    }
    const handlePorcentaje = async({porcentaje,id,tipo})=>{
        const response = await PutPersonaLibro({persona:JSON.stringify({porcentaje:porcentaje,id:id,tipo:tipo}),isbn:data.isbn});
        if(response.success) {
            tipo == 0 ? setLibro({...libro,autores:libro.autores.map(autor => autor.id === id ? {...autor,porcentaje:porcentaje} : autor)}) : setLibro({...libro,ilustradores:libro.ilustradores.map(ilustrador => ilustrador.id === id ? {...ilustrador,porcentaje:porcentaje} : ilustrador)});
        }


    }
    const handleDelete = ({isbn,id,type}) => {
       
        DeletePersonFromBook({isbn,id,type});
        
        type == 0 ? setLibro({...libro,autores:libro.autores.filter(autor => autor.id !== id)}) : setLibro({...libro,ilustradores:libro.ilustradores.filter(ilustrador => ilustrador.id !== id)});
    }

    if (loading) { 
        return <div>Loading...</div>;
    } else {
        
        return (
            <div className='container ml-3 mr-3'>
                <Row>
                    <Col>
                            <div>
                                <h4>Autores</h4>
                                <ListGroup>
                                    {libro.autores.map(autor => { 
                                        return (
                                            <ListGroup.Item key={autor.id}>
                                                {autor.nombre}
                                                {' '}
                                                {autor.porcentaje}%
                                                <button type="button" className="btn-close align-middle" aria-label="Close" onClick={() => handleDelete({isbn:data.isbn,id:autor.id,type:0})}/>
                                                <ModalEdit handlePorcentaje={handlePorcentaje} porcentajeInicial={autor.porcentaje} id={autor.id} tipo={0}/>
                                            </ListGroup.Item>
                                            
                                        );
                                    })}
                                    <ListGroup.Item>
                                        <ModalPersonaExistente options={people} onSave={HandleExistentePush} type="Autor"/>{' '}
                                        <ModalNuevaPersona type="Autor" setPerson={HandleNuevoPush} person={[{tipo:0}]}/>
                                    </ListGroup.Item>
                                </ListGroup>
                            </div>
                        
                    </Col>
                    <Col>
                        <h4>Ilustradores</h4>
                        <ListGroup>
                            {libro.ilustradores.map(ilustrador => {
                                return (
                                    <ListGroup.Item key={ilustrador.id}>
                                        {ilustrador.nombre}
                                        {' '}
                                        {ilustrador.porcentaje}%
                                        <button type="button" className="btn-close align-middle" aria-label="Close" onClick={() => handleDelete({isbn:data.isbn,id:ilustrador.id,type:1})}/>
                                        <ModalEdit handlePorcentaje={handlePorcentaje} porcentajeInicial={ilustrador.porcentaje} id={ilustrador.id} tipo={1}/>
                                    </ListGroup.Item>

                                );
                            })}
                            <ListGroup.Item>
                                <ModalPersonaExistente options={people} onSave={HandleExistentePush} type="Ilustrador"/>{' '}
                                <ModalNuevaPersona type="Ilustrador" setPerson={HandleNuevoPush} person={[{tipo:1}]}/>
                            </ListGroup.Item>

                        </ListGroup>
                    </Col>
                </Row>
            </div>
        );
    }
}


const ModalEdit = ({handlePorcentaje,porcentajeInicial,id,tipo}) => {
    const [show, setShow] = React.useState(false);
    const [porcentaje, setPorcentaje] = React.useState(0);
    const handleClose = () => setShow(false);
    const handleShow = () => setShow(true);
    const onChange = (e) => {
        setPorcentaje(parseInt(e.target.value));
    }
    return (
        <>
            <button className="btn btn-outline btn-xs" onClick={handleShow}>✏️</button>
            <Modal show={show} onHide={handleClose}>
                <Modal.Header closeButton>
                    <Modal.Title>Cambiar porcentaje</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Group className="mb-3" controlId="formBasicEmail">
                            <Form.Label>Porcentaje</Form.Label>
                            <Form.Control type="number" placeholder="Porcentaje" defaultValue={porcentajeInicial} onChange={onChange}/>
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleClose}>
                        Cerrar
                    </Button>
                    <Button variant="primary" onClick={() => handlePorcentaje({porcentaje:porcentaje,id:id,tipo:tipo})}>
                        Enviar
                    </Button>
                </Modal.Footer>
            </Modal>
        </>);
}




const FilterComponent = ({ filterText, onFilter, onClear }) => (
    
    <InputGroup>
        <Form.Control 
            id="search"
            type="text"
            placeholder="Buscar por titulo..."
            value={filterText}
            onChange={onFilter} />
        <Button variant="outline-secondary" onClick={onClear}>x</Button>
    </InputGroup>
    

);

const columns = (handleButtonClick) => ([
    {
        name: 'Titulo',
        selector: row => row.titulo,
        sortable: false,
    },
    {
        name: 'ISBN',
        selector: row => row.isbn,
        sortable: false,
    },
    {
        name: 'Precio',
        selector: row => row.precio,
        sortable: true,
    },
    {
        name: 'Stock',
        selector: row => row.stock,
        sortable: true,
    },
    {
        name: 'Fecha de edición',
        selector: row => formatDate(row.fecha_edicion),
        sortable: false,
    },
    {
        name: "Editar",
        button: true,
        cell: (row) => (
            <button
                className="btn btn-outline btn-xs"
                onClick={(e) => handleButtonClick(e, row.isbn)}
            >
                ✏️
            </button>
        )

    }
    
    
]);





export function formatDate(dateString) {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString();
  
    return `${day}/${month}/${year}`;
  }


const ModalEditLibro = ({libro,show,setShow,setLibros,libros}) => {
    const isbn = libro.isbn;
    const handleClose = () => setShow(false);
    const [fechaDefault, setFechaDefault] = React.useState("");


    const handleSubmit = async (event) => {
        event.preventDefault();
        const edit =JSON.stringify({
            titulo: event.target.titulo.value,
            fecha_edicion: event.target["fecha-edicion"].value,
            precio: parseFloat(event.target.precio.value),
            stock: parseInt(event.target.stock.value)
          });
        handleClose();
        const response = await PutLibro({edit,isbn});
        
        if(response.success) {
            
           const aux = libros.map((libro) => {
                if(libro.isbn === isbn) {
                    libro.titulo = event.target.titulo.value;
                    libro.fecha_edicion = event.target["fecha-edicion"].value;
                    libro.precio = parseFloat(event.target.precio.value);
                    libro.stock = parseInt(event.target.stock.value);
                }
                return libro;
            });
            setLibros(aux);
            
        }else alert("Error al editar libro");


    }
    
    if(libro.fecha_edicion !== undefined && libro.fecha_edicion.substring(0, 10) !== fechaDefault) setFechaDefault(libro.fecha_edicion.substring(0, 10))
    
    
    return (

        <Modal show={show} onHide={handleClose}>
          <Modal.Header closeButton>
            <Modal.Title>Editar Libro</Modal.Title>
          </Modal.Header>
          <Modal.Body>
          <Form onSubmit={handleSubmit}>
                <Form.Label>Titulo</Form.Label>
                <Form.Control className="mb-3" name="titulo" defaultValue={libro.titulo}/>
                <Form.Label>Precio</Form.Label>                                      
                <Form.Control className="mb-3" name="precio" type="number" step="0.01" defaultValue={libro.precio}/>
                <Form.Label>Stock</Form.Label>                                     
                <Form.Control className="mb-3" type="number"  name="stock"  defaultValue={libro.stock}/>
                <Form.Label>Fecha Edicion</Form.Label>                                     
                <Form.Control className="mb-3" type="date"  name="fecha-edicion"  defaultValue={fechaDefault}/>
                <Button variant="primary" type='submit'>
                Enviar
                </Button>{' '}
                <Button variant="secondary" onClick={handleClose}>
                Cancelar
                </Button>            
            </Form>
          </Modal.Body>
        </Modal>
    );
}