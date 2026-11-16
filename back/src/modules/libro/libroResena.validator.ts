import { z } from "zod";

const url = z
    .string()
    .trim()
    .max(500)
    .refine((value) => URL.canParse(value) && /^https?:$/.test(new URL(value).protocol), {
        message: "La reseña tiene que ser un link http(s) válido"
    });

const body = z.object({ url }).strict();
const pk = z.object({ isbn: z.string(), id: z.coerce.number().int().positive() });

export type LibroResenaBody = z.infer<typeof body>;

export const libroResenaValidator = { body, pk };
