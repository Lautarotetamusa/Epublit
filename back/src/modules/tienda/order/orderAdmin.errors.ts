import { ApiError } from "../../../lib/http/errors";

export type OrderAdminErrorCode =
    | "no_encontrado"
    | "transicion_invalida"
    | "pago_no_aprobado"
    | "correo_no_configurado"
    | "direccion_invalida"
    | "peso_faltante"
    | "proveedor_no_disponible"
    | "etiqueta_duplicada"
    | "sin_envio"
    | "facturacion_fallida";

// Errores del panel de pedidos con el código estable que consume el front.
// Extiende `ApiError` para que `handleErrors` los serialice con
// `errors[0].code` (ver specs/016-tienda-ecommerce).
export class OrderAdminError extends ApiError {
    constructor(status: number, code: OrderAdminErrorCode, message: string) {
        super(status, message, code);
    }
}
