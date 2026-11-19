import { ApiError } from "../api/client";
import type { ApiErrorItem } from "../api/client";

// Único lugar que sabe traducir un error de la API a un mensaje mostrable:
// evita repetir "if (err instanceof ApiError) ..." en cada handler de submit.
export function getErrorMessage(err: unknown): string {
    if (err instanceof ApiError) return err.errors.map((e) => e.message).join(" — ");
    if (err instanceof Error) return err.message;
    return "Error desconocido";
}

// Las rutas que mandan `{success:false, errors:[{code, field?, email?}]}`
// devuelven un solo error: el primero es el que decide qué muestra la UI.
export function getApiErrorDetail(err: unknown): ApiErrorItem | null {
    return err instanceof ApiError ? (err.errors[0] ?? null) : null;
}
