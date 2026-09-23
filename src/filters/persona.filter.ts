import { FilterMap } from "bradb";
import { eq } from "drizzle-orm";
import { personasTable } from "../schemas/personas.schema";
import { personaValidator } from "../validators/persona.validator";

export const personaFilterMap: FilterMap<typeof personaValidator.filter> = {
    user: (val) => eq(personasTable.user, val)
};
