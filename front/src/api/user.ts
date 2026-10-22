import { api } from "./client";

// Refleja back/src/modules/user/user.schema.ts (sin `password`, la tabla
// nunca la devuelve) + user.validator.ts#select.
export type User = {
    id: number;
    username: string;
    cuit: string;
    cond_fiscal: string;
    razon_social: string;
    domicilio: string;
    production: boolean | null;
    email: string | null;
    ingresos_brutos: boolean;
    fecha_inicio: string;
    punto_venta: number | null;
    // Restricciones de la foto de persona (autor/ilustrador): configurables
    // por editorial en vez de fijas en el componente (ver
    // specs/004-persona-foto-bio/design.md — "Datos necesarios"). Todavía
    // no existen en el backend.
    fotoPersonaMaxSizeMb: number | null;
    fotoPersonaMinAnchoPx: number | null;
    fotoPersonaMinAltoPx: number | null;
};

export type UpdateUserInput = Partial<{
    email: string;
    punto_venta: number;
    // `null` limpia la restricción ("sin límite"), a diferencia del resto
    // de los campos donde no mandar la clave ya significa "no tocar".
    fotoPersonaMaxSizeMb: number | null;
    fotoPersonaMinAnchoPx: number | null;
    fotoPersonaMinAltoPx: number | null;
}>;

export const getMe = (): Promise<{ success: true; data: User }> => api.get("/user");

// Sin `:id` en la ruta (PUT /user a secas): el backend resuelve el usuario
// por el token, no por un id en la URL (ver back/src/modules/user/user.routes.ts).
export const updateMe = (input: UpdateUserInput): Promise<{ success: true; data: User }> => api.put("/user", input);

export const refreshAfipData = (): Promise<{ success: true; data: User }> => api.put("/user/afip");
