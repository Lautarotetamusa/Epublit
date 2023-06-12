import {Button, Col, Row, Form,Table,InputGroup} from 'react-bootstrap';
import React from 'react';
import { PostVenta,GetVentaById} from '../ApiHandler';
import { formatDate } from '../libros/ListaLibros';
import DataTable from 'react-data-table-component';



const AltaVenta = ({Clientes,medioPago,libros}) =>{
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
        const venta =JSON.stringify({
          cliente: parseInt(event.target.cliente.value),
          descuento: parseFloat(event.target.descuento.value),
          medio_pago: parseInt(event.target.medio_pago.value),
          libros: listaLibros
        });
        
        PostVenta(venta);
        event.target.reset();
        setLibrosSeleccionados([]);
      }



  return (
    <div className='container mt-3'>
    <Form onSubmit={handleSubmit}>
      <Row className="mb-3 mt-3">
      <Form.Group as={Col} controlId="cliente">
          <Form.Label>Cliente</Form.Label>
          <Form.Select>
            {Clientes.map((client) => (
                <option key={client.id} value={client.id}>{client.nombre}</option>
            ))}
          </Form.Select>
        </Form.Group>
        <Form.Group as={Col} controlId="descuento">
          <Form.Label>Descuento</Form.Label>
          <Form.Control type="number" min="0" max="100" step="0.01" placeholder="0.00" />
        </Form.Group>

        <Form.Group as={Col} controlId="medio_pago">
          <Form.Label>Medio de Pago</Form.Label>
          <Form.Select defaultValue="Choose...">
            {medioPago.map((medio,index) => (
                <option key={index} value={index}>{medio}</option>
            ))}
          </Form.Select>
        </Form.Group>
      </Row>
      

  <h4>Libros</h4>

      {librosSeleccionados.map((libro) => (
            <div key={libro.libro.isbn}>
                <span className="align-middle">📘{libro.libro.titulo}</span>{' '}
                <span className="align-middle">({libro.cantidad})</span>
                <button type="button" className="btn-close align-middle" aria-label="Close" onClick={() => handleSeleccionadoDelete(libro.libro.isbn)}/>
              </div>
              ))}

    <br/>
    
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

export const Ventas = ({Clientes,medioPago,libros,ventas}) => {
    return (
        <div className='container mt-3'>
            <h2>Nueva venta</h2>
            <AltaVenta Clientes={Clientes} medioPago={medioPago} libros={libros}/>
            <ListaVentas ventas={ventas} medioDePago={medioPago}/>

          </div>
    );
}

const ListaVentas = ({ventas,medioDePago}) => {

  const [filterText, setFilterText] = React.useState('');
	const [resetPaginationToggle, setResetPaginationToggle] = React.useState(false);

	
	const filteredItems = ventas.filter(
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
			title="Ventas"
			columns={columns(medioDePago)}
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



const columns =(medioDePago) =>([
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
        name: 'Medio de pago',
        selector: row => medioDePago[row.medio_pago],
        sortable: true,
    },
    {
        name: 'Fecha',
        selector: row => formatDate(row.fecha),
        sortable: false,
    },
    {
      name: 'Total',
      selector: row => row.total,
      sortable: true,
  }

]);

const ExpandedComponent = ({ data }) => {
  const [loading, setLoading] = React.useState(true);
  const [ventas, setVentas] = React.useState(null);
  const [path, setPath] = React.useState(null);

  React.useEffect(() => {
          fetchVentas();
          
      }, [data.id]);

  const fetchVentas = async () => {
      try {
          const venta = await GetVentaById(data.id);
          setVentas(venta);
          
          setLoading(false);
          getPath(venta);
          
      } catch (error) {
          console.error(error);
          setLoading(false);
      }
  };
  
  
  const getPath = (venta)=> {
    
    if(venta != null){
      try{
        console.log("archivo: ", `../../comprobantes/facturas/${venta.file_path}`)
        setPath(require(`../../comprobantes/facturas/${venta.file_path}`));
      }catch(e){
        console.log("no hay archivo");
        console.log(e);
      }
    } 
    
  }

  
  if(loading){
      return <p>Loading...</p>
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
          <th>Precio</th>
          </tr>
      </thead>
      <tbody>
          {ventas.libros.map(fila=>(
              <tr key={fila.isbn}>
              <td>{fila.isbn}</td>
              <td>{fila.titulo}</td>
              <td>{fila.cantidad}</td>
              <td>{fila.precio_venta}</td>
              </tr>
          )
          )}
          
      </tbody>
      </Table>
      <Button variant="success" onClick={() => window.open(path, '_blank')}>Factura</Button>
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