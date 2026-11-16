import { useEffect, useState } from "react";
import { getMe } from "../../api/user";

// La sesión sólo guarda el usuario: el encabezado del reporte por autor
// necesita la razón social de la cuenta, que vive en el perfil.
export function useRazonSocial() {
    const [razonSocial, setRazonSocial] = useState("");

    useEffect(() => {
        getMe().then((response) => setRazonSocial(response.data.razon_social));
    }, []);

    return razonSocial;
}
