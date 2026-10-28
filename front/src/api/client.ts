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

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type QueryValue = string | number | boolean | undefined;

export type RequestOptions = {
    // Algunos endpoints devuelven un resultado de negocio con status no-2xx
    // (ej. probar la conexión de envíos responde 422 con `{api,ok,mensaje}`).
    allowedStatuses?: number[];
};

export type BlobFile = {
    blob: Blob;
    filename: string | null;
};

export function toQueryString(params: Record<string, QueryValue>): string {
    const entries = Object.entries(params).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return "";

    const search = new URLSearchParams();
    for (const [key, value] of entries) search.set(key, String(value));
    return `?${search.toString()}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function parseJson(text: string): unknown {
    if (!text) return undefined;
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}

// Los errores del backend no tienen una sola forma: las rutas de la app usan
// `{errors:[{code,message}]}`; la prueba de conexión de envíos devuelve
// `{api,ok,mensaje}` incluso en 422; las rutas públicas usan
// `{error:{codigo,...}}`. Acá se normalizan para que la UI tenga un mensaje
// mostrable en todos los casos.
function parseErrors(data: unknown): ApiErrorItem[] {
    if (!isRecord(data)) {
        return [{ code: "Error", message: "Error desconocido" }];
    }

    if (Array.isArray(data.errors) && data.errors.length > 0) {
        return data.errors as ApiErrorItem[];
    }

    if (typeof data.mensaje === "string" && data.mensaje.trim() !== "") {
        return [{ code: "Error", message: data.mensaje }];
    }

    if (typeof data.error === "string" && data.error.trim() !== "") {
        return [{ code: "Error", message: data.error }];
    }

    if (typeof data.message === "string" && data.message.trim() !== "") {
        return [{ code: "Error", message: data.message }];
    }

    return [{ code: "Error", message: "Error desconocido" }];
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = { ...extra };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

async function request<T>(
    path: string,
    method: Method,
    body?: unknown,
    options?: RequestOptions
): Promise<T> {
    const headers = authHeaders({ "Content-Type": "application/json" });

    const res = await fetch(`${API_URL}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined
    });

    // 204/DELETE sin body: `deleted()` en el backend sí manda JSON, así que
    // esto es sólo defensivo para respuestas realmente vacías.
    const text = await res.text();
    const data = parseJson(text);

    if (!res.ok && !options?.allowedStatuses?.includes(res.status)) {
        throw new ApiError(res.status, parseErrors(data));
    }

    return data as T;
}

// Descarga autenticada: el token va en el header, nunca en la URL (la ruta de
// etiqueta exige `Authorization`). El caller decide si abre o descarga el blob
// con `lib/descargas.ts`.
async function getBlob(path: string): Promise<BlobFile> {
    const res = await fetch(`${API_URL}${path}`, {
        method: "GET",
        headers: authHeaders()
    });

    if (!res.ok) {
        const text = await res.text();
        throw new ApiError(res.status, parseErrors(parseJson(text)));
    }

    const disposition = res.headers.get("Content-Disposition");
    const match = disposition ? /filename="?([^";]+)"?/i.exec(disposition) : null;

    return {
        blob: await res.blob(),
        filename: match?.[1] ?? null
    };
}

// Subida de archivo (multipart/form-data): separado de `request` porque un
// FormData no se debe serializar a JSON ni llevar Content-Type manual (el
// browser arma el boundary). Mismo esquema de auth/errores que el resto.
// Sigue el patrón ya usado por `POST /user/uploadCert` en el backend
// (ver back/src/modules/user/user.routes.ts, multer.single).
async function postFile<T>(path: string, fieldName: string, file: File): Promise<T> {
    const body = new FormData();
    body.append(fieldName, file);

    const res = await fetch(`${API_URL}${path}`, {
        method: "POST",
        headers: authHeaders(),
        body
    });
    const text = await res.text();
    const data = parseJson(text);

    if (!res.ok) {
        throw new ApiError(res.status, parseErrors(data));
    }

    return data as T;
}

export const api = {
    get: <T>(path: string, options?: RequestOptions): Promise<T> => request<T>(path, "GET", undefined, options),
    post: <T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> =>
        request<T>(path, "POST", body, options),
    put: <T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> =>
        request<T>(path, "PUT", body, options),
    patch: <T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> =>
        request<T>(path, "PATCH", body, options),
    // Con body: algunos DELETE del backend lo necesitan (ej. `DELETE
    // /libro/:isbn/personas`, ver back/src/modules/libro/libroPersona.validator.ts).
    del: <T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> =>
        request<T>(path, "DELETE", body, options),
    getBlob: (path: string): Promise<BlobFile> => getBlob(path),
    postFile: <T>(path: string, fieldName: string, file: File): Promise<T> => postFile<T>(path, fieldName, file)
};
