import React from "react";
import {Button, Col, Row, Form,Spinner,Table,InputGroup} from 'react-bootstrap';
import {PostConsignacion,GetConsignacionByID} from '../ApiHandler';
import {formatDate} from '../libros/ListaLibros';
import DataTable from 'react-data-table-component';
import Swal from 'sweetalert2';

export const ConsignacionesForm =({clientes,libros}) => {
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
      event.preventDefault();
        if(inputs.cantidad === "" || inputs.libro === ""){
            Swal.fire({
              title: "Advertencia",
              text: "Debe completar todos los campos",
              icon: "warning"
            });
            
        }else{
          
          setLibrosSeleccionados([...librosSeleccionados,{cantidad: inputs.cantidad, libro: libros.find((libro) => inputs.libro === libro.isbn)}]);
          setInputs({libro: "", cantidad: ""});
        }
        
        
        };
    
        const handleSubmit = (event) => {
            event.preventDefault();
            const listaLibros = librosSeleccionados.map((libro) => {
              return {
                isbn: libro.libro.isbn,
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

export const Consignaciones = ({consignaciones,clientes,libros}) => {
  return (
    <div className='container mt-1'>
      <ConsignacionesForm clientes={clientes} libros={libros}/>
      <ListaConsignaciones consignaciones={consignaciones}/>  
    </div>
  );
}


    const ListaConsignaciones = ({consignaciones}) => {

      const [filterText, setFilterText] = React.useState('');
      const [resetPaginationToggle, setResetPaginationToggle] = React.useState(false);
    
      
      const filteredItems = consignaciones.filter(
        item => item.nombre_cliente && item.nombre_cliente.toLowerCase().includes(filterText.toLowerCase()),
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
    
    
    
      return (
        <div className='container mt-1'>
          <DataTable
          title="Consignaciones"
          columns={columns}
          data={filteredItems}
          pagination
          paginationResetDefaultPage={resetPaginationToggle}
          subHeader
          subHeaderComponent={subHeaderComponentMemo}
          persistTableHead
          expandableRows
          expandableRowsComponent={ExpandedComponent}
          
        />
        </div>
        
      );
    }
    
    
    
    const columns =[
        {
            name: 'ID',
            selector: row => row.id,
            sortable: true,
        },
        {
            name: 'Nombre Cliente',
            selector: row => row.nombre_cliente,
            sortable: true,
        },
        {
          name: 'Cuit',
          selector: row => row.cuit,
          sortable: true,
        },
        {
            name: 'Fecha',
            selector: row => formatDate(row.fecha),
            sortable: true,
        }
   
    ];
    
    const ExpandedComponent = ({ data }) => {
      const [loading, setLoading] = React.useState(true);
      const [consignacion, setConsignacion] = React.useState(null);
      const [path, setPath] = React.useState(null);
    
      React.useEffect(() => {
              fetchConsignaciones();// eslint-disable-next-line react-hooks/exhaustive-deps
          }, [data.id]);
    
      const fetchConsignaciones = async () => {
          try {
              const cons = await GetConsignacionByID(data.id);
              setConsignacion(cons);
              
              setLoading(false);
              getPath(cons);
              
          } catch (error) {
              console.error(error);
              setLoading(false);
          }
      };
      
      
      const getPath = (consignacion)=> {
        console.log("archivo: ", `../../comprobantes/remitos/${consignacion.remito_path}`)
        
        if(consignacion != null){
          try{
            console.log("archivo: ", `../../comprobantes/remitos/${consignacion.remito_path}`)
            setPath(require(`../../comprobantes/remitos/${consignacion.remito_path}`));
          }catch(e){
            console.log("no hay archivo");
            console.log(e);
          }
        } 
        
      }
    
      
      if(loading){
        return (
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        );
      }
      else{
      return (
          <div className="container">
          <Table striped bordered hover size="sm">
          <thead>
              <tr>
              <th>ISBN</th>
              <th>Titulo</th>
              <th>Cantidad</th>
              </tr>
          </thead>
          <tbody>
              {consignacion.libros.map(fila=>(
                  <tr key={fila.isbn}>
                  <td>{fila.isbn}</td>
                  <td>{fila.titulo}</td>
                  <td>{fila.cantidad}</td>
                  </tr>
              )
              )}
              
          </tbody>
          </Table>
          <Button variant="success" onClick={() => window.open(path, '_blank')}>Remito</Button>
          </div>
      );
      }
    }
    
    
    
    
    
    const FilterComponent = ({ filterText, onFilter, onClear }) => (
        
      <InputGroup>
          <Form.Control 
              id="search"
              type="text"
              placeholder="Buscar por cliente..."
              value={filterText}
              onChange={onFilter} />
          <Button variant="outline-secondary" onClick={onClear}>x</Button>
      </InputGroup>
      
    
    );
