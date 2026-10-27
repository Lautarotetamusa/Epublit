import type { ZodType } from "zod";
import { ExternalServiceError } from "../../../lib/http/errors";

// Sin tope, un proveedor colgado retiene la conexión del pool y los locks de
// stock de quien espera su respuesta.
const REQUEST_TIMEOUT_MS = 10_000;

export type RequestOptions = {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
};

export const providerTimeout = (): AbortSignal => AbortSignal.timeout(REQUEST_TIMEOUT_MS);

export async function responseBody(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) return null;

    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

export function parseProviderResponse<T>(
    provider: string,
    schema: ZodType<T>,
    value: unknown,
    message = `${provider} devolvió una respuesta inválida`
): T {
    const result = schema.safeParse(value);
    if (!result.success) {
        throw new ExternalServiceError(provider, message, undefined, result.error.issues);
    }

    return result.data;
}

export async function requestJson<T>(
    provider: string,
    url: string,
    options: RequestOptions = {}
): Promise<T> {
    let response: Response;

    try {
        response = await fetch(url, { ...options, signal: providerTimeout() });
    } catch (err) {
        throw new ExternalServiceError(provider, `No se pudo conectar con ${provider}`, undefined, err);
    }

    const body = await responseBody(response);

    if (!response.ok) {
        throw new ExternalServiceError(
            provider,
            `${provider} respondió ${response.status}`,
            response.status,
            body
        );
    }

    return body as T;
}
