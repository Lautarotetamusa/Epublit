import { NavBar } from './components/NavBar';
import './App.css';
import { GetPersonas, GetPeople, GetLibros, GetClientes,GetMedioPago,GetAllVentas,setToken,GetConsignaciones} from './components/ApiHandler';
import React,{ useEffect,useState } from 'react';
import { DataPersonTable } from './components/personas/DataTable';
import { Route, Routes } from 'react-router-dom';
import { NuevoLibro } from './components/libros/NuevoLibro';
import { ListaLibros } from './components/libros/ListaLibros';
import { Clientes } from './components/clientes/Clientes';
import { Ventas } from './components/ventas/Ventas';
import {Consignaciones} from './components/consignaciones/Consignaciones';
import { Login } from './components/login/Login';
import { Spinner } from 'react-bootstrap';



const UserInitialState = {
  username: "",
  token: "",
};

const Home = () => (
  <div className='bdy'>
    <span className='title'>Libros Silvestres</span>
  </div>);

const Autores = () => {

  const [authors,setAuthors] = useState([]);
  const fetchAuthors = async () => {
      const data = await GetPeople('autor');
      setAuthors(data);
    }

  useEffect(() => {
    fetchAuthors();
  }, []);

  return(
  <div> 
    <DataPersonTable data={authors} setPeople={setAuthors} type={"Autores"}/>
  </div>
  );
}


const Ilustradores = () => {
  const [illustrators,setIllustrators] = useState([]);

  const fetchIllustrators = async () => {
    const data = await GetPeople('ilustrador');
    setIllustrators(data);
  }

  useEffect(() => {fetchIllustrators()},[]);


  return(
  <div> 
    <DataPersonTable data={illustrators} setPeople={setIllustrators} type={"Ilustradores"}/>
  </div>
  );
}
const ListarLibros = () => {
  const [personas,setPersonas] = useState([]);

  const fetchPersonas = async () => {
    const data = await GetPersonas();
    setPersonas(data);
    
  }

  const [libros,setLibros] = useState([]);
  const fetchLibros = async () => {
    const data = await GetLibros();
    setLibros(data);
    
  }
  useEffect(() => {fetchLibros();fetchPersonas();},[]);
  return(
    <ListaLibros libros={libros} people={personas} setLibros={setLibros}/>
  );
}


const CrearLibro = () => {
  const [personas,setPersonas] = useState([]);

  const fetchPersonas = async () => {
    const data = await GetPersonas();
    setPersonas(data);
    
  }
  useEffect(() => {fetchPersonas()},[]);

  return(
    <NuevoLibro personas={personas}/>
  );
}

const ShowClientes = () => {
  const [clientes,setClientes] = useState([]);

  const fetchClientes = async () => {
    const data = await GetClientes();
    setClientes(data);
    
  }
  useEffect(() => {fetchClientes()},[]);
  return(
    <Clientes clientes={clientes} setClientes={setClientes}/>
  );
}

const ShowVentas = () => {
  const [clientes,setClientes] = useState([]);
  const fetchClientes = async () => {
    const data = await GetClientes();
    setClientes(data);
    
  }

  const [libros,setLibros] = useState([]);
  const fetchLibros = async () => {
    const data = await GetLibros();
    setLibros(data);
    
  }

  const[medioPago,setMedioPago] = useState([]);
  const fetchMedioPago = async () => {
    const data = await GetMedioPago();
    setMedioPago(data);
    
  }
  const[ventas,setVentas] = useState([]);
  const fetchVentas = async () => {
    const data = await GetAllVentas();
    setVentas(data);
    
  }


  useEffect(() => {fetchClientes();fetchLibros();fetchMedioPago();fetchVentas();},[]);
 
  return(
    <Ventas Clientes={clientes} libros={libros} medioPago={medioPago} ventas={ventas}/>
  );
}


const ShowConsignaciones = () => {
  const [clientes,setClientes] = useState([]);
  const fetchClientes = async () => {
    const data = await GetClientes();
    setClientes(data);
    
  }


  const [libros,setLibros] = useState([]);
  const fetchLibros = async () => {
    const data = await GetLibros();
    setLibros(data);
    
  }

  const[consignaciones,setConsignaciones] = useState([]);
  const fetchConsignaciones = async () => {
    const data = await GetConsignaciones();
    setConsignaciones(data);
  }

  useEffect(() => {fetchClientes();fetchLibros();fetchConsignaciones()},[]);



  return(
    <Consignaciones consignaciones={consignaciones} clientes={clientes} libros={libros}/>
  );
}

const LoggedInRender = ({ handleLogout }) => (
  <div className='App'>
      <NavBar handleLogout={handleLogout}/>
      <Routes>
        <Route path="/" element={<Home/>}/>
        <Route path="/lista-libros" element={<ListarLibros/>}/>
        <Route path="/nuevo-libro" element={<CrearLibro/>}/>
        <Route path="/ventas" element={<ShowVentas/>}/>
        <Route path="/clientes" element={<ShowClientes/>}/>
        <Route path="/autores" element={<Autores/>}/>
        <Route path="/ilustradores" element={<Ilustradores/>}/>
        <Route path="/consignaciones" element={<ShowConsignaciones/>}/>
        
      </Routes>
    </div>
);


function App() {

  const [user, setUser] = React.useState(UserInitialState);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loggedUserJSON = localStorage.getItem('loggedUser');
    if(loggedUserJSON){
      const userParsed = JSON.parse(loggedUserJSON);
      setUser(userParsed);
      setToken(userParsed.token);
      }
      setLoading(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('loggedUser');
    setUser(UserInitialState);
    setToken("");
  };

  if (loading) {
    return <Spinner className="loading-spinner" animation="border" role="status"/>
  }
  return <>{(user !== UserInitialState) ? <LoggedInRender handleLogout={handleLogout}/> : <Login setUser={setUser}/>}</>;
  
}

export default App;


