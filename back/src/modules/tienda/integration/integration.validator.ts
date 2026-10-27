import { z } from "zod";

const INVALID_ORIGIN =
    "El origen debe ser una URL absoluta http/https, sin credenciales, path, query ni fragmento";

function isAllowedAbsoluteOrigin(value: string): boolean {
    try {
        const url = new URL(value);
        return (
            (url.protocol === "http:" || url.protocol === "https:") &&
            url.hostname.length > 0 &&
            url.username === "" &&
            url.password === "" &&
            (url.pathname === "" || url.pathname === "/") &&
            url.search === "" &&
            url.hash === ""
        );
    } catch {
        return false;
    }
}

function normalizeOrigin(value: string): string {
    return new URL(value).origin;
}

export const integrationOrigin = z
    .string()
    .trim()
    .min(1, "El origen es obligatorio")
    .refine(isAllowedAbsoluteOrigin, { message: INVALID_ORIGIN })
    .transform(normalizeOrigin);

const create = z
    .object({
        nombre: z.string().trim().min(1, "El nombre es obligatorio").max(120),
        origen: integrationOrigin
    })
    .strict();

const update = z
    .object({
        activa: z.boolean()
    })
    .strict();

const id = z.coerce.number().int().positive();

export type IntegrationCreate = z.infer<typeof create>;
export type IntegrationUpdate = z.infer<typeof update>;

export const integrationValidator = {
    create,
    update,
    id
};
