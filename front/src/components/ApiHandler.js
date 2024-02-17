const HOST = process.env.REACT_APP_HOST;
const API_PORT = process.env.REACT_APP_API_PORT;
import Swal from 'sweetalert2';


let TOKEN = "";

export const setToken = (token) => {
    TOKEN = token;
}

const handleAlert = (message,type) => {
    const title = type === "success" ? "Exito" : "Error";
    Swal.fire({
        title: title,
        text: message,
        icon: type
      });}


export const GetPeople = async (type) => {
    // type =  'autor' || 'ilustrador' ?tipo=${type}
    
    const URL = `${HOST}:${API_PORT}/persona?tipo=${type}`;
    try{
        const response = await fetch(URL,{
            method: "GET",
            headers: {"Authorization": TOKEN,
        }});
        const data = await response.json();
        return data;
    }catch(error){
        console.log(error);
    }
}

export const GetPersonas = async () => {

    
    const URL = `${HOST}:${API_PORT}/persona`;
    try{
        const response = await fetch(URL,{
            method: "GET",
            headers: {"Authorization": TOKEN,
        }});
        const data = await response.json();
        return data;
    }catch(error){
        console.log(error);
    }
}

export const GetLibros = async () => {

    
    const URL = `${HOST}:${API_PORT}/libro`;
    try{
        const response = await fetch(URL,{
            method: "GET",
            headers: {"Authorization": TOKEN,
        }});
        const data = await response.json();
        return data;
    }catch(error){
        console.log(error);
    }
}

export const GetLibro = async (isbn) => {

    
    const URL = `${HOST}:${API_PORT}/libro/${isbn}`;
    try{
        const response = await fetch(URL,{
            method: "GET",
            headers: {"Authorization": TOKEN,
        }});
        const data = await response.json();
        return data;
    }catch(error){
        console.log(error);
    }
}

export const GetMedioPago = async () => {

    
    const URL = `${HOST}:${API_PORT}/venta/medios_pago`;
    try{
        const response = await fetch(URL,{
            method: "GET",
            headers: {"Authorization": TOKEN,
        }});
        const data = await response.json();
        return data;
    }catch(error){
        console.log(error);
    }
}

export const PostPeople = async (inputs) => {
    const URL = `${HOST}:${API_PORT}/persona`;
    try{
        const response = await fetch(URL, {
            method: "POST",
            body: JSON.stringify(inputs),
            headers: {"Content-type": "application/json; charset=UTF-8",
            "Authorization": TOKEN}
            });
        const data = await response.json();
        !response.ok ? handleAlert(data.error,"error") : handleAlert(data.message,"success");
        return data;
        
    }catch(error){
        console.log(error);
    }
}

export const PutLibro = async ({edit,isbn}) => {
    const URL = `${HOST}:${API_PORT}/libro/${isbn}`;
    try{
        const response = await fetch(URL, {
            method: "PUT",
            body: edit,
            headers: {"Content-type": "application/json; charset=UTF-8",
            "Authorization": TOKEN}
            });
        const data = await response.json();
        console.log(data);
        !response.ok || !data.success ? handleAlert(data.error,"error") : handleAlert(data.message,"success");
        return data;
    }catch(error){
        console.log(error);
    }
}

export const PutCliente = async ({edit,id}) => {
    const URL = `${HOST}:${API_PORT}/cliente/${id}`;
    try{
        const response = await fetch(URL, {
            method: "PUT",
            body: edit,
            headers: {"Content-type": "application/json; charset=UTF-8",
            "Authorization": TOKEN}
            });
        const data = await response.json();
        console.log(data);
        !response.ok || !data.success ? handleAlert(data.error,"error") : handleAlert(data.message,"success");
        return data;
    }catch(error){
        console.log(error);
    }
}

export const DeleteCliente = async (id) => {
    const URL = `${HOST}:${API_PORT}/cliente/${id}`;
    try{
        const response = await fetch(URL, {
            method: "DELETE",
            headers: {"Content-type": "application/json; charset=UTF-8",
            "Authorization": TOKEN}
            });
        const data = await response.json();
        console.log(data);
        !response.ok ? handleAlert(data.error,"error") : handleAlert(data.message,"success");
        return data;
    }catch(error){
        console.log(error);
    }
}

export const PutPersonaLibro = async ({persona,isbn}) => {
    const URL = `${HOST}:${API_PORT}/libro/${isbn}/personas`;
    try{
        const response = await fetch(URL, {
            method: "PUT",
            body: persona,
            headers: {"Content-type": "application/json; charset=UTF-8",
            "Authorization": TOKEN}
            });
        const data = await response.json();
        console.log(data);
        !response.ok || !data.success ? handleAlert(data.error,"error") : handleAlert(data.message,"success");
        return data;
    }catch(error){
        console.log(error);
    }
}


export const GetVentas = async (id) => {

    
    const URL = `${HOST}:${API_PORT}/cliente/${id}/ventas`;
    try{
        const response = await fetch(URL,{
            method: "GET",
            headers: {"Authorization": TOKEN,
        }});
        const data = await response.json();
        return data;
    }catch(error){
        console.log(error);
    }
}

export const GetAllVentas = async () => {

    
    const URL = `${HOST}:${API_PORT}/venta`;
    try{
        const response = await fetch(URL,{
            method: "GET",
            headers: {"Authorization": TOKEN,
        }});
        const data = await response.json();
        return data;
    }catch(error){
        console.log(error);
    }
}

export const GetConsignaciones = async () => {

    
    const URL = `${HOST}:${API_PORT}/consignacion`;
    try{
        const response = await fetch(URL,{
            method: "GET",
            headers: {"Authorization": TOKEN,
        }});
        const data = await response.json();
        return data;
    }catch(error){
        console.log(error);
    }
}

export const GetConsignacionByID = async (id) => {
    const URL = `${HOST}:${API_PORT}/consignacion/${id}`;
    try{
        const response = await fetch(URL,{
            method: "GET",
            headers: {"Authorization": TOKEN,
        }});
        const data = await response.json();
        return data;
    }catch(error){
        console.log(error);
    }
}
export const GetVentaById = async (id) => {
    const URL = `${HOST}:${API_PORT}/venta/${id}`;
    try{
        const response = await fetch(URL,{
            method: "GET",
            headers: {"Authorization": TOKEN,
        }});
        const data = await response.json();
        return data;
    }catch(error){
        console.log(error);
    }
}

export const GetStockById = async (id) => {
    const URL = `${HOST}:${API_PORT}/cliente/${id}/stock`;
    try{
        const response = await fetch(URL,{
            method: "GET",
            headers: {"Authorization": TOKEN,
        }});
        const data = await response.json();
        return data;
    }catch(error){
        console.log(error);
    }
}


export const PostVenta = async (inputs) => {
    const URL = `${HOST}:${API_PORT}/venta`;
    try{
        const response = await fetch(URL, {
            method: "POST",
            body: inputs,
            headers: {"Content-type": "application/json; charset=UTF-8",
            "Authorization": TOKEN}
            });
        const data = await response.json();
        !response.ok ? handleAlert(data.error,"error") : handleAlert(data.message,"success");
        return data;
    }catch(error){
        console.log(error);
    }
}




export const PostLibro = async (inputs) => {
    const URL = `${HOST}:${API_PORT}/libro`;
    try{
        const response = await fetch(URL, {
            method: "POST",
            body: inputs,
            headers: {"Content-type": "application/json; charset=UTF-8",
            "Authorization": TOKEN}
            });
        const data = await response.json();
        !response.ok ? handleAlert(data.error,"error") : handleAlert(data.message,"success");
        return data;
    }catch(error){
        console.log(error);
    }
}

export const PostPeopleLibro = async ({people,isbn}) => {
    const URL = `${HOST}:${API_PORT}/libro/${isbn}/personas`;
    try{
        const response = await fetch(URL, {
            method: "POST",
            body: people,
            headers: {"Content-type": "application/json; charset=UTF-8",
            "Authorization": TOKEN}
            });
        const data = await response.json();
        !response.ok ? handleAlert(data.error,"error") : handleAlert(data.message,"success");
        return data;
    }catch(error){
        console.log(error);
    }
}

export const PostPerson = async (inputs) => {
    try{
        const response = await fetch(`${HOST}:${API_PORT}/persona`, {
            method: "POST",
            body: JSON.stringify(inputs),
            headers: {"Content-type": "application/json; charset=UTF-8",
            "Authorization": TOKEN}
            });
        const data = await response.json();
        
        !response.ok ? handleAlert(data.error,"error") : handleAlert(data.message,"success");
        return data;
    }catch(error){
        console.log(error);
    }
}

export const PostCliente = async (inputs) => {
    try{
        const response = await fetch(`${HOST}:${API_PORT}/cliente`, {
            method: "POST",
            body: inputs,
            headers: {"Content-type": "application/json; charset=UTF-8",
            "Authorization": TOKEN}
            });
        const data = await response.json();
        !response.ok ? handleAlert(data.error,"error") : handleAlert(data.message,"success");
        return data;
    }catch(error){
        console.log(error);
    }

}

export const PostConsignacion = async (inputs) => {
    try{
        const response = await fetch(`${HOST}:${API_PORT}/consignacion`, {
            method: "POST",
            body: inputs,
            headers: {"Content-type": "application/json; charset=UTF-8",
            "Authorization": TOKEN}
            });
        const data = await response.json();
        !response.ok ? handleAlert(data.error,"error") : handleAlert(data.message,"success");
        return data;
    }catch(error){
        console.log(error);
    }

}




export const DeletePersonFromBook = async ({isbn,id,type}) => {
    const Content = JSON.stringify({
        "id": id,
        "tipo": type
    }); 
    

    const URL = `${HOST}:${API_PORT}/libro/${isbn}/personas`;
    try{
        const response = await fetch(URL, {
            method: "DELETE",
            body: Content,
            headers: {"Content-type": "application/json; charset=UTF-8",
            "Authorization": TOKEN}
            });
        const data = await response.json();
       !response.ok ? handleAlert(data.error,"error") : handleAlert(data.message,"success");
        return data;

    }catch(error){
        console.log(error);
    }
}


export const GetClientes = async () => {
    const URL = `${HOST}:${API_PORT}/cliente`;
    try{
        const response = await fetch(URL,{
            method: "GET",
            headers: {"Authorization": TOKEN,
        }});
        const data = await response.json();
        return data;
    }catch(error){
        console.log(error);
    }
}




export const DeletePerson = async (id) => { 
    const URL = `${HOST}:${API_PORT}/persona/${id}`;
    try{
        const response = await fetch(URL, {
            method: "DELETE",
            headers: {"Content-type": "application/json; charset=UTF-8",
            "Authorization": TOKEN}
            });
        const data = await response.json();
        return data;
    }catch(error){
        console.log(error);
    }
}


export const PostLogin = async (user)  => {
    const URL = `${HOST}:${API_PORT}/user/login`;
    try{
        const response = await fetch(URL, {
            method: "POST",
            body: JSON.stringify(user),
            headers: {"Content-type": "application/json; charset=UTF-8"}
            });

        const data = await response.json();
        return data;
    }catch(error){
        console.log(error);
    }
}


