import { ApiError } from "../api/client";

// Único lugar que sabe traducir un error de la API a un mensaje mostrable:
// evita repetir "if (err instanceof ApiError) ..." en cada handler de submit.
export function getErrorMessage(err: unknown): string {
    if (err instanceof ApiError) return err.errors.map((e) => e.message).join(" — ");
    if (err instanceof Error) return err.message;
    return "Error desconocido";
}
