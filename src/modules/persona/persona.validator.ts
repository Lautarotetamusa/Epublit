import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { createPkSchema } from "bradb";
import { z } from "zod";
import { personasTable } from "./persona.schema";

// Validators nuevos (Postgres/Drizzle), usados por persona.controller.ts/persona.service.ts.
const select = createSelectSchema(personasTable);
const insert = createInsertSchema(personasTable).omit({
    user: true,
    deletedAt: true
});
const update = insert.partial();
const filter = z
    .object({
        user: z.number()
    })
    .partial();
const pk = createPkSchema(personasTable).pick({
    id: true
});

export type PersonaInsert = z.infer<typeof insert>;
export type PersonaUpdate = z.infer<typeof update>;
export type Persona = z.infer<typeof select>;

export const personaValidator = {
    select,
    insert,
    update,
    filter,
    pk
};
