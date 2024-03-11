const HOST = process.env.REACT_APP_HOST;
const API_PORT = process.env.REACT_APP_API_PORT;
import Swal from "sweetalert2";

let TOKEN = "";

export const setToken = (token) => {
  TOKEN = token;
};

const handleAlert = (message, type) => {
  const title = type === "success" ? "Exito" : "Error";
  Swal.fire({
    title: title,
    text: message,
    icon: type,
  });
};

export const fetchData = async (endpoint, method, body = null) => {
  const URL = `${HOST}:${API_PORT}/${endpoint}`;
  const headers = {
    Authorization: TOKEN,
    "Content-type": "application/json; charset=UTF-8",
  };

  const requestOptions = {
    method,
    headers,
  };

  if (body) {
    requestOptions.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(URL, requestOptions);
    const data = await response.json();
    response.ok
      ? handleAlert(data.message, "success")
      : handleAlert(data.error, "error");

    return data;
  } catch (error) {
    const errorMessage = error.toString() || "Error desconocido";
    handleAlert(errorMessage, "error");
    return null;
  }
};

export const GetPeople = async (type) => {
  return fetchData(`persona?tipo=${type}`, "GET");
};

export const GetPersonas = async () => {
  return fetchData("persona", "GET");
};

export const GetLibros = async () => {
  return fetchData("libro", "GET");
};

export const GetLibro = async (isbn) => {
  return fetchData(`libro/${isbn}`, "GET");
};

export const GetMedioPago = async () => {
  return fetchData("venta/medios_pago", "GET");
};

export const PostPeople = async (inputs) => {
  return fetchData("persona", "POST", inputs);
};

export const PutLibro = async ({ edit, isbn }) => {
  return fetchData(`libro/${isbn}`, "PUT", edit);
};

export const PutCliente = async ({ edit, id }) => {
  return fetchData(`cliente/${id}`, "PUT", edit);
};

export const DeleteCliente = async (id) => {
  return fetchData(`cliente/${id}`, "DELETE");
};

export const PutPersonaLibro = async ({ persona, isbn }) => {
  return fetchData(`libro/${isbn}/personas`, "PUT", persona);
};

export const GetVentas = async (id) => {
  return fetchData(`cliente/${id}/ventas`, "GET");
};

export const GetAllVentas = async () => {
  return fetchData("venta", "GET");
};

export const GetConsignaciones = async () => {
  return fetchData("consignacion", "GET");
};

export const GetConsignacionByID = async (id) => {
  return fetchData(`consignacion/${id}`, "GET");
};

export const GetVentaById = async (id) => {
  return fetchData(`venta/${id}`, "GET");
};

export const GetStockById = async (id) => {
  return fetchData(`cliente/${id}/stock`, "GET");
};

export const PostVenta = async (cliente, descuento, medio_pago, libros) => {
  return fetchData("venta", "POST", { cliente, descuento, medio_pago, libros });
};

export const PostLibro = async (inputs) => {
  return fetchData("libro", "POST", inputs);
};

export const PostPeopleLibro = async ({ people, isbn }) => {
  return fetchData(`libro/${isbn}/personas`, "POST", people);
};

export const PostPerson = async (inputs) => {
  return fetchData("persona", "POST", inputs);
};

export const PostCliente = async (inputs) => {
  return fetchData("cliente", "POST", inputs);
};

export const PostConsignacion = async (inputs) => {
  return fetchData("consignacion", "POST", inputs);
};

export const DeletePersonFromBook = async ({ isbn, id, type }) => {
  const content = {
    id: id,
    tipo: type,
  };

  return fetchData(`libro/${isbn}/personas`, "DELETE", content);
};

export const GetClientes = async () => {
  return fetchData("cliente", "GET");
};

export const DeletePerson = async (id) => {
  return fetchData(`persona/${id}`, "DELETE");
};

export const PostLogin = async (user) => {
  return fetchData("user/login", "POST", user);
};
