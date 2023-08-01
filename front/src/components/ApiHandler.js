const HOST = process.env.REACT_APP_HOST;
const API_PORT = process.env.REACT_APP_API_PORT;
//const PROTOCOL = process.env.REACT_PROTOCOL;
//const PROTOCOL = "http";
const PROTOCOL = "https";

let TOKEN = "";

console.log(`backend: ${PROTOCOL}://${HOST}:${API_PORT}`);

export const setToken = (token) => {
    TOKEN = token;
}

export const GetPeople = async (type) => {
    // type =  'autor' || 'ilustrador' ?tipo=${type}
    
    const URL = `${PROTOCOL}://${HOST}:${API_PORT}/persona?tipo=${type}`;
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

    
    const URL = `${PROTOCOL}://${HOST}:${API_PORT}/persona`;
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

    
    const URL = `${PROTOCOL}://${HOST}:${API_PORT}/libro`;
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

    
    const URL = `${PROTOCOL}://${HOST}:${API_PORT}/libro/${isbn}`;
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

    
    const URL = `${PROTOCOL}://${HOST}:${API_PORT}/venta/medios_pago`;
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
    const URL = `${PROTOCOL}://${HOST}:${API_PORT}/persona`;
    try{
        const response = await fetch(URL, {
            method: "POST",
            body: JSON.stringify(inputs),
            headers: {"Content-type": "application/json; charset=UTF-8",
            "Authorization": TOKEN}
            });
        const data = await response.json();
        !response.ok ? alert(data.error) : alert(data.message);
        return data;
        
    }catch(error){
        console.log(error);
    }
}

export const PutLibro = async ({edit,isbn}) => {
    const URL = `${PROTOCOL}://${HOST}:${API_PORT}/libro/${isbn}`;
    try{
        const response = await fetch(URL, {
            method: "PUT",
            body: edit,
            headers: {"Content-type": "application/json; charset=UTF-8",
            "Authorization": TOKEN}
            });
        const data = await response.json();
        console.log(data);
        !response.ok || !data.success ? alert(data.error) : alert(data.message);
        return data;
    }catch(error){
        console.log(error);
    }
}

export const PutCliente = async ({edit,id}) => {
    const URL = `${PROTOCOL}://${HOST}:${API_PORT}/cliente/${id}`;
    try{
        const response = await fetch(URL, {
            method: "PUT",
            body: edit,
            headers: {"Content-type": "application/json; charset=UTF-8",
            "Authorization": TOKEN}
            });
        const data = await response.json();
        console.log(data);
        !response.ok || !data.success ? alert(data.error) : alert(data.message);
        return data;
    }catch(error){
        console.log(error);
    }
}

export const DeleteCliente = async (id) => {
    const URL = `${PROTOCOL}://${HOST}:${API_PORT}/cliente/${id}`;
    try{
        const response = await fetch(URL, {
            method: "DELETE",
            headers: {"Content-type": "application/json; charset=UTF-8",
            "Authorization": TOKEN}
            });
        const data = await response.json();
        console.log(data);
        !response.ok ? alert(data.error) : alert(data.message);
        return data;
    }catch(error){
        console.log(error);
    }
}

export const PutPersonaLibro = async ({persona,isbn}) => {
    const URL = `${PROTOCOL}://${HOST}:${API_PORT}/libro/${isbn}/personas`;
    try{
        const response = await fetch(URL, {
            method: "PUT",
            body: persona,
            headers: {"Content-type": "application/json; charset=UTF-8",
            "Authorization": TOKEN}
            });
        const data = await response.json();
        console.log(data);
        !response.ok || !data.success ? alert(data.error) : alert(data.message);
        return data;
    }catch(error){
        console.log(error);
    }
}


export const GetVentas = async (id) => {

    
    const URL = `${PROTOCOL}://${HOST}:${API_PORT}/cliente/${id}/ventas`;
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

    
    const URL = `${PROTOCOL}://${HOST}:${API_PORT}/venta`;
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
    const URL = `${PROTOCOL}://${HOST}:${API_PORT}/venta/${id}`;
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
    const URL = `${PROTOCOL}://${HOST}:${API_PORT}/cliente/${id}/stock`;
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
    const URL = `${PROTOCOL}://${HOST}:${API_PORT}/venta`;
    try{
        const response = await fetch(URL, {
            method: "POST",
            body: inputs,
            headers: {"Content-type": "application/json; charset=UTF-8",
            "Authorization": TOKEN}
            });
        const data = await response.json();
        !response.ok ? alert(data.error) : alert(data.message);
        return data;
    }catch(error){
        console.log(error);
    }
}




export const PostLibro = async (inputs) => {
    const URL = `${PROTOCOL}://${HOST}:${API_PORT}/libro`;
    try{
        const response = await fetch(URL, {
            method: "POST",
            body: inputs,
            headers: {"Content-type": "application/json; charset=UTF-8",
            "Authorization": TOKEN}
            });
        const data = await response.json();
        !response.ok ? alert(data.error) : alert(data.message);
        return data;
    }catch(error){
        console.log(error);
    }
}

export const PostPeopleLibro = async ({people,isbn}) => {
    const URL = `${PROTOCOL}://${HOST}:${API_PORT}/libro/${isbn}/personas`;
    try{
        const response = await fetch(URL, {
            method: "POST",
            body: people,
            headers: {"Content-type": "application/json; charset=UTF-8",
            "Authorization": TOKEN}
            });
        const data = await response.json();
        !response.ok ? alert(data.error) : alert(data.message);
        return data;
    }catch(error){
        console.log(error);
    }
}

export const PostPerson = async (inputs) => {
    try{
        const response = await fetch(`${PROTOCOL}://${HOST}:${API_PORT}/persona`, {
            method: "POST",
            body: JSON.stringify(inputs),
            headers: {"Content-type": "application/json; charset=UTF-8",
            "Authorization": TOKEN}
            });
        const data = await response.json();
        
        !response.ok ? alert(data.error) : alert(data.message);
        return data;
    }catch(error){
        console.log(error);
    }
}

export const PostCliente = async (inputs) => {
    try{
        const response = await fetch(`${PROTOCOL}://${HOST}:${API_PORT}/cliente`, {
            method: "POST",
            body: inputs,
            headers: {"Content-type": "application/json; charset=UTF-8",
            "Authorization": TOKEN}
            });
        const data = await response.json();
        !response.ok ? alert(data.error) : alert(data.message);
        return data;
    }catch(error){
        console.log(error);
    }

}

export const PostConsignacion = async (inputs) => {
    try{
        const response = await fetch(`${PROTOCOL}://${HOST}:${API_PORT}/consignacion`, {
            method: "POST",
            body: inputs,
            headers: {"Content-type": "application/json; charset=UTF-8",
            "Authorization": TOKEN}
            });
        const data = await response.json();
        !response.ok ? alert(data.error) : alert(data.message);
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
    

    const URL = `${PROTOCOL}://${HOST}:${API_PORT}/libro/${isbn}/personas`;
    try{
        const response = await fetch(URL, {
            method: "DELETE",
            body: Content,
            headers: {"Content-type": "application/json; charset=UTF-8",
            "Authorization": TOKEN}
            });
        const data = await response.json();
       !response.ok ? alert(data.error) : alert(data.message);
        return data;

    }catch(error){
        console.log(error);
    }
}


export const GetClientes = async () => {
    const URL = `${PROTOCOL}://${HOST}:${API_PORT}/cliente`;
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
    const URL = `${PROTOCOL}://${HOST}:${API_PORT}/persona/${id}`;
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
    const URL = `${PROTOCOL}://${HOST}:${API_PORT}/user/login`;
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


