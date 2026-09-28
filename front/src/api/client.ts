// Cliente HTTP único: todo el resto de src/api/*.ts pasa por acá. Conoce el
// sobre real de las respuestas del backend (back/src/lib/http/responses.ts
// y errors.ts) — no el que asumía la app vieja (arrays sueltos).
export type Pagination = {
    page: number;
    pageSize: number;
    total: number;
    count: number;
};

export type ListEnvelope<T> = {
    pagination: Pagination;
    items: T[];
};

export type ApiErrorItem = {
    code: string;
    message: string;
};

export class ApiError extends Error {
    status: number;
    errors: ApiErrorItem[];

    constructor(status: number, errors: ApiErrorItem[]) {
        super(errors.map((e) => e.message).join("\n") || "Error desconocido");
        this.status = status;
        this.errors = errors;
    }
}

const API_URL = import.meta.env.VITE_API_URL;

// Vive en memoria (no en localStorage directo): quien decide de dónde sale
// el token y dónde persiste la sesión es `auth/AuthContext.tsx`, esto sólo
// lo usa para firmar requests.
let token: string | null = null;

export function setAuthToken(value: string | null): void {
    token = value;
}

type Method = "GET" | "POST" | "PUT" | "DELETE";

type QueryValue = string | number | boolean | undefined;

export function toQueryString(params: Record<string, QueryValue>): string {
    const entries = Object.entries(params).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return "";

    const search = new URLSearchParams();
    for (const [key, value] of entries) search.set(key, String(value));
    return `?${search.toString()}`;
}

async function request<T>(path: string, method: Method, body?: unknown): Promise<T> {
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_URL}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined
    });

    // 204/DELETE sin body: `deleted()` en el backend sí manda JSON, así que
    // esto es sólo defensivo para respuestas realmente vacías.
    const text = await res.text();
    const data = text ? JSON.parse(text) : undefined;

    if (!res.ok) {
        const errors: ApiErrorItem[] = data?.errors ?? [{ code: "Error", message: data?.error ?? "Error desconocido" }];
        throw new ApiError(res.status, errors);
    }

    return data as T;
}

// Subida de archivo (multipart/form-data): separado de `request` porque un
// FormData no se debe serializar a JSON ni llevar Content-Type manual (el
// browser arma el boundary). Mismo esquema de auth/errores que el resto.
// Sigue el patrón ya usado por `POST /user/uploadCert` en el backend
// (ver back/src/modules/user/user.routes.ts, multer.single).
async function postFile<T>(path: string, fieldName: string, file: File): Promise<T> {
    const headers: HeadersInit = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const body = new FormData();
    body.append(fieldName, file);

    const res = await fetch(`${API_URL}${path}`, { method: "POST", headers, body });
    const text = await res.text();
    const data = text ? JSON.parse(text) : undefined;

    if (!res.ok) {
        const errors: ApiErrorItem[] = data?.errors ?? [{ code: "Error", message: data?.error ?? "Error desconocido" }];
        throw new ApiError(res.status, errors);
    }

    return data as T;
}

export const api = {
    get: <T>(path: string): Promise<T> => request<T>(path, "GET"),
    post: <T>(path: string, body?: unknown): Promise<T> => request<T>(path, "POST", body),
    put: <T>(path: string, body?: unknown): Promise<T> => request<T>(path, "PUT", body),
    // Con body: algunos DELETE del backend lo necesitan (ej. `DELETE
    // /libro/:isbn/personas`, ver back/src/modules/libro/libroPersona.validator.ts).
    del: <T>(path: string, body?: unknown): Promise<T> => request<T>(path, "DELETE", body),
    postFile: <T>(path: string, fieldName: string, file: File): Promise<T> => postFile<T>(path, fieldName, file)
};
