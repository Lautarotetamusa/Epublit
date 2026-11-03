import { FilterMap } from "bradb";
import { eq } from "drizzle-orm";
import { ilikeSinAcentos } from "../../lib/sql/search";
import { personasTable } from "./persona.schema";
import { personaValidator } from "./persona.validator";

export const personaFilterMap: FilterMap<typeof personaValidator.filter> = {
    user: (val) => eq(personasTable.user, val),
    nombre: (val) => ilikeSinAcentos(personasTable.nombre, val)
};
