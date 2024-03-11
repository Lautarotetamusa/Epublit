import React, { useEffect, useState } from "react";
import DataTable from "react-data-table-component";
import { DeleteCliente, PutCliente, PostCliente,GetVentas,GetVentaById,GetStockById,GetClientes} from '../ApiHandler';
import { Modal, Button, Form , InputGroup,Row,Col,Table, Spinner} from 'react-bootstrap';
import { formatDate } from "../libros/ListaLibros";

const Clientes = ({ clientes, setClientes }) => {
  const [filterText, setFilterText] = useState("");
  const [resetPaginationToggle, setResetPaginationToggle] = useState(false);
  const [showModal, setModalShow] = useState(false);
  const [clienteEdit, setClienteEdit] = useState({});

  const filteredItems = clientes.filter(
    (item) =>
      item.nombre &&
      item.nombre.toLowerCase().includes(filterText.toLowerCase())
  );

  const subHeaderComponentMemo = React.useMemo(() => {
    const handleClear = () => {
      if (filterText) {
        setResetPaginationToggle(!resetPaginationToggle);
        setFilterText("");
      }
    };

    return (
      <FilterComponent
        onFilter={(e) => setFilterText(e.target.value)}
        onClear={handleClear}
        filterText={filterText}
      />
    );
  }, [filterText, resetPaginationToggle]);

  const handleButtonClick = (e, id) => {
    e.preventDefault();
    setClienteEdit(clientes.find((item) => item.id === id));
    setModalShow(true);
  };
  const handleDeleteCliente = async (id) => {
    const response = await DeleteCliente(id);
    if (response.success) {
      setClientes(clientes.filter((item) => item.id !== id));
    }
  };

  return (
    <div className="container mt-1">
      <AltaClienteForm setClientes={setClientes} clientes={clientes} />
      <ModalEditarClientes
        cliente={clienteEdit}
        clientes={clientes}
        setClientes={setClientes}
        setShow={setModalShow}
        show={showModal}
      />
      <DataTable
        title="Clientes"
        columns={columns(handleButtonClick, handleDeleteCliente)}
        data={filteredItems}
        pagination
        paginationResetDefaultPage={resetPaginationToggle} // optionally, a hook to reset pagination to page 1
        subHeader
        subHeaderComponent={subHeaderComponentMemo}
        persistTableHead
        expandableRows
        expandableRowsComponent={ExpandedComponent}
      />
    </div>
  );
};

const columns = (handleButtonClick, handleDeleteCliente) => [
  {
    name: "ID",
    selector: (row) => row.id,
    sortable: true,
  },
  {
    name: "Nombre",
    selector: (row) => row.nombre,
    sortable: false,
  },
  {
    name: "Email",
    selector: (row) => row.email,
    sortable: false,
  },
  {
    name: "CUIT",
    selector: (row) => row.cuit,
    sortable: false,
  },
  {
    name: "Accion",
    button: true,
    cell: (row) => (
      <>
        <button
          className="btn btn-outline btn-xs"
          onClick={(e) => handleButtonClick(e, row.id)}
        >
          ✏️
        </button>{" "}
        <button
          type="button"
          className="btn-close align-middle"
          aria-label="Close"
          onClick={() => handleDeleteCliente(row.id)}
        />
      </>
    ),
  },
];

const ModalEditarClientes = ({
  cliente,
  setClientes,
  show,
  setShow,
  clientes,
}) => {
  const handleClose = () => setShow(false);
  const id = cliente.id;

  const handleSubmit = async (event) => {
    event.preventDefault();
    const edit = JSON.stringify({
      nombre: event.target.nombre.value,
      email: event.target.email.value,
    });
    handleClose();
    const response = await PutCliente({ edit, id });
    if (response.success) {
      const aux = clientes.map((item) => {
        if (item.id === cliente.id) {
          item.nombre = event.target.nombre.value;
          item.email = event.target.email.value;
          item.cuit = event.target.cuit.value;
        }
        return item;
      });
      setClientes(aux);
    }
  };

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Editar Cliente</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          <Form.Label>Nombre</Form.Label>
          <Form.Control
            className="mb-3"
            name="nombre"
            defaultValue={cliente.nombre}
          />
          <Form.Label>Email</Form.Label>
          <Form.Control
            className="mb-3"
            name="email"
            defaultValue={cliente.email}
          />
          <Form.Label>Cuit</Form.Label>
          <Form.Control
            className="mb-3"
            name="cuit"
            defaultValue={cliente.cuit}
          />
          <Button variant="primary" type="submit">
            Enviar
          </Button>{" "}
          <Button variant="secondary" onClick={handleClose}>
            Cancelar
          </Button>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

const AltaClienteForm = ({ setClientes, clientes }) => {
  const handleSubmit = async (event) => {
    event.preventDefault();
    const cliente = JSON.stringify({
      nombre: event.target.nombre.value,
      email: event.target.email.value,
      cuit: event.target.cuit.value,
      tipo: 1,
    });

    const response = await PostCliente(cliente);
    if (response.success) {
      setClientes([...clientes, response.data]);
    }
  };

  return (
    <div className="container mt-5">
      <h4>Nuevo Cliente</h4>
      <Form onSubmit={handleSubmit}>
        <Row className="mb-3">
          <Col sm>
            <Form.Control className="mb-3" name="nombre" placeholder="Nombre" />
          </Col>
          <Col sm>
            <Form.Control className="mb-3" name="email" placeholder="Email" />
          </Col>
          <Col sm>
            <Form.Control className="mb-3" name="cuit" placeholder="CUIT" />
          </Col>
          <Col sm>
            <Button variant="primary" type="submit">
              Enviar
            </Button>
          </Col>
        </Row>
      </Form>
    </div>
  );
};

const ExpandedComponent = ({ data }) => {
  const [loading, setLoading] = useState(true);
  const [ventas, setVentas] = useState(null);
  const [stock, setStock] = useState(null);
  // const [path, setPath] = useState(null);

  const fetchVentas = async () => {
    try {
      const venta = await GetVentas(data.id);
      const promises = venta.map(async (vent) => {
        return await GetVentaById(vent.id);
      });
      const results = await Promise.all(promises);
      const response = await GetStockById(data.id);
      setStock(response);
      setVentas(results);
      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchVentas(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.id]);

  if (loading) {
    return (
      <Spinner animation="border" role="status">
        <span className="visually-hidden">Loading...</span>
      </Spinner>
    );
  } else {
    return (
      <div className="container">
        <h4>Ventas</h4>
        <Table bordered hover size="sm">
          <thead>
            <tr>
              <th className="align-middle text-center">ID</th>
              <th>Titulo</th>
              <th>Cantidad</th>
              <th>Precio</th>
              <th>Fecha</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {ventas.map((venta, index) => (
              <React.Fragment key={venta.id}>
                {venta.libros.map((libro, libroIndex) => (
                  <tr key={`${index}-${libroIndex}`}>
                    {libroIndex === 0 && (
                      <>
                        <td
                          className="align-middle text-center"
                          rowSpan={venta.libros.length}
                        >
                          {venta.id}
                        </td>
                        <td>{libro.titulo}</td>
                        <td className="text-center"> {libro.cantidad}</td>
                        <td className="text-end">{libro.precio_venta}</td>
                        <td
                          className="text-center align-middle"
                          rowSpan={venta.libros.length}
                        >
                          {formatDate(venta.fecha)}
                        </td>
                        <td
                          className="text-end align-middle"
                          rowSpan={venta.libros.length}
                        >
                          {venta.total}
                        </td>
                      </>
                    )}
                    {libroIndex !== 0 && (
                      <>
                        <td>{libro.titulo}</td>
                        <td className="text-center">{libro.cantidad}</td>
                        <td className="text-end">{libro.precio_venta}</td>
                      </>
                    )}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </Table>
        <h4>Stock Consignado</h4>
        <Table striped bordered hover size="sm">
          <thead>
            <tr>
              <th>Titulo</th>
              <th>ISBN</th>
              <th>Stock</th>
            </tr>
          </thead>
          <tbody>
            {stock.map((fila) => (
              <tr key={fila.isbn}>
                <td>{fila.titulo}</td>
                <td>{fila.isbn}</td>
                <td>{fila.stock}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    );
  }
};

const FilterComponent = ({ filterText, onFilter, onClear }) => (
  <InputGroup>
    <Form.Control
      id="search"
      type="text"
      placeholder="Buscar por nombre..."
      value={filterText}
      onChange={onFilter}
    />
    <Button variant="outline-secondary" onClick={onClear}>
      x
    </Button>
  </InputGroup>
);

export const ShowClientes = () => {
  const [clientes, setClientes] = useState([]);

  const fetchClientes = async () => {
    const data = await GetClientes();
    setClientes(data);
  };
  useEffect(() => {
    fetchClientes();
  }, []);
  return <Clientes clientes={clientes} setClientes={setClientes} />;
};
