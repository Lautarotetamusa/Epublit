import { z } from "zod";

const query = z
    .object({
        buscar: z.string().trim().min(1).optional(),
        pagina: z.coerce.number().int().min(1).default(1),
        porPagina: z.coerce.number().int().min(1).max(100).default(20)
    })
    .strict();

const isbn = z.string().trim().min(1).max(13);

export type CatalogQueryInput = z.infer<typeof query>;

export const catalogValidator = {
    query,
    isbn
};
