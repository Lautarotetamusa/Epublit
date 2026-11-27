import { ApiError } from "../../lib/http/errors";

// Los códigos son el contrato con el front (decide qué mensaje mostrar); el
// sobre de error lo arma `handleErrors` como el resto de la API.
export const erroresAdmin = {
    estadoInvalido: () =>
        new ApiError(400, "El estado debe ser activo o inactivo", "invalid_estado", { field: "estado" }),
    arcaInvalido: () =>
        new ApiError(400, "ARCA debe ser con o sin", "invalid_arca", { field: "arca" }),
    paginaInvalida: () =>
        new ApiError(400, "La página debe ser un entero positivo", "invalid_pagina", { field: "pagina" })
};
