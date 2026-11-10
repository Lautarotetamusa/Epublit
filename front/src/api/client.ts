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

// Detalle de validación del sobre `{error:{codigo,mensaje,detalles}}` (hoy lo
// usan las rutas de contenido y la API pública de la tienda). `campo` es la
// ruta del dato en el cuerpo, para poder ubicarlo en el formulario.
export type ApiErrorDetalle = {
    campo: string;
    codigo: string;
    mensaje: string;
};

type ParsedErrors = {
    errors: ApiErrorItem[];
    codigo: string | null;
    detalles: ApiErrorDetalle[];
};

export class ApiError extends Error {
    status: number;
    errors: ApiErrorItem[];
    // Código estable del sobre (`slug_duplicado`, `publicacion_incompleta`,
    // `archivo_demasiado_grande`…). `null` en las rutas viejas que no lo mandan.
    codigo: string | null;
    detalles: ApiErrorDetalle[];

    constructor(status: number, errors: ApiErrorItem[], codigo: string | null = null, detalles: ApiErrorDetalle[] = []) {
        super(errors.map((e) => e.message).join("\n") || "Error desconocido");
        this.status = status;
        this.errors = errors;
        this.codigo = codigo;
        this.detalles = detalles;
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
// `{api,ok,mensaje}` incluso en 422; las rutas de contenido y la API pública
// usan `{error:{codigo,mensaje,detalles}}`. Acá se normalizan para que la UI
// tenga un mensaje mostrable en todos los casos.
function parseErrors(data: unknown): ParsedErrors {
    if (!isRecord(data)) {
        return { errors: [{ code: "Error", message: "Error desconocido" }], codigo: null, detalles: [] };
    }

    if (isRecord(data.error)) {
        const codigo = typeof data.error.codigo === "string" ? data.error.codigo : "Error";
        const mensaje =
            typeof data.error.mensaje === "string" && data.error.mensaje.trim() !== ""
                ? data.error.mensaje
                : "Error desconocido";
        const detalles = Array.isArray(data.error.detalles)
            ? data.error.detalles.flatMap((detalle): ApiErrorDetalle[] => {
                  if (!isRecord(detalle)) return [];
                  return [
                      {
                          campo: typeof detalle.campo === "string" ? detalle.campo : "",
                          codigo: typeof detalle.codigo === "string" ? detalle.codigo : codigo,
                          mensaje: typeof detalle.mensaje === "string" ? detalle.mensaje : mensaje
                      }
                  ];
              })
            : [];

        return { errors: [{ code: codigo, message: mensaje }], codigo, detalles };
    }

    if (Array.isArray(data.errors) && data.errors.length > 0) {
        return { errors: data.errors as ApiErrorItem[], codigo: null, detalles: [] };
    }

    if (typeof data.mensaje === "string" && data.mensaje.trim() !== "") {
        return { errors: [{ code: "Error", message: data.mensaje }], codigo: null, detalles: [] };
    }

    if (typeof data.error === "string" && data.error.trim() !== "") {
        return { errors: [{ code: "Error", message: data.error }], codigo: null, detalles: [] };
    }

    if (typeof data.message === "string" && data.message.trim() !== "") {
        return { errors: [{ code: "Error", message: data.message }], codigo: null, detalles: [] };
    }

    return { errors: [{ code: "Error", message: "Error desconocido" }], codigo: null, detalles: [] };
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
        const parsed = parseErrors(data);
        throw new ApiError(res.status, parsed.errors, parsed.codigo, parsed.detalles);
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
        const parsed = parseErrors(parseJson(text));
        throw new ApiError(res.status, parsed.errors, parsed.codigo, parsed.detalles);
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
// `fields` permite mandar datos adicionales junto al archivo (ej. `uso` de una
// imagen de contenido), que el backend espera en el mismo multipart.
// Sigue el patrón ya usado por `POST /user/uploadCert` en el backend
// (ver back/src/modules/user/user.routes.ts, multer.single).
async function postFile<T>(
    path: string,
    fieldName: string,
    file: File,
    fields: Record<string, string> = {}
): Promise<T> {
    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) body.append(key, value);
    body.append(fieldName, file);

    const res = await fetch(`${API_URL}${path}`, {
        method: "POST",
        headers: authHeaders(),
        body
    });
    const text = await res.text();
    const data = parseJson(text);

    if (!res.ok) {
        const parsed = parseErrors(data);
        throw new ApiError(res.status, parsed.errors, parsed.codigo, parsed.detalles);
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
    postFile: <T>(path: string, fieldName: string, file: File, fields?: Record<string, string>): Promise<T> =>
        postFile<T>(path, fieldName, file, fields)
};
